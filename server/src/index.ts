/**
 * Express + Socket.IO multiplayer backend for Chase.
 *
 * The only backend in the project. Holds room state in memory and relays
 * lobby + in-game events between the React game clients.
 *
 * Resilience: players are keyed by a stable `user_id`, so a refresh or a brief
 * network drop does NOT free their slot immediately. On disconnect the slot is
 * kept for RECONNECT_GRACE_MS; if the same user re-attaches (via `rejoin-room`)
 * within the window their slot — and live game session — is restored, exactly
 * like professional games. Voice signalling (WebRTC offer/answer/ICE) is relayed
 * room-scoped for proximity voice chat.
 *
 *   dev:   npm run dev    (tsx watch, hot reload)
 *   start: npm start      (tsx, used by Render — see ../render.yaml)
 *
 * Port: PORT (Render) or SOCKET_PORT, default 3001.
 */
// MUST be first: loads server/.env into process.env before any module below reads
// it (computeRouter.ts reads OG_* at import time). No-op on Render, which injects
// env vars directly. Never commit the real .env.
import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import { decideIntents, forgetRoom, getTranscript, type AgentSnapshot } from './agents/agentBrain';
import { ogComputeEnabled, getOgClient, OG_MODEL } from './og/computeRouter';
import { uploadReplay, ogStorageEnabled } from './og/storage';
import { submitMatch, getRecent, ogChainEnabled, ogChainReadEnabled } from './og/chain';

const PORT = Number(process.env.SOCKET_PORT || process.env.PORT || 3001);
/** How long a disconnected player's slot is held open for them to come back. */
const RECONNECT_GRACE_MS = 30_000;

interface LobbyPlayer {
  id: string;
  player_name: string;
  user_id: string;
  is_ready: boolean;
  character_id: string;
  /** Live connection bookkeeping for reconnect + voice routing. */
  connected: boolean;
  socket_id: string;
}

interface Room {
  mapId: string;
  isPublic: boolean;
  players: LobbyPlayer[];
  hostUserId: string;
  started: boolean;
  serverStartTime: number | null;
  /** user_id -> pending removal timer (cleared if they reconnect in time). */
  graceTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** user_ids currently in the proximity voice channel. */
  voiceUsers: Set<string>;
}

/** In-memory room store, keyed by 6-char room code. */
const rooms = new Map<string, Room>();

/** Rooms with an agent-brain inference in flight — prevents overlapping 0G calls
 *  (and duplicate spend) for the same room. */
const agentTickInFlight = new Set<string>();

/** Replay upload bookkeeping (Phase 2 / 0G Storage). Upload a given room's replay to
 *  0G Storage exactly once, then serve the cached {rootHash,txHash} to any later asker
 *  (each MP client emits store-replay independently when its match ends). */
interface StoredReplay { rootHash: string | null; txHash: string | null; chainTxHash: string | null; transcriptLen: number; ogStorageEnabled: boolean; ogChainEnabled: boolean; }
const replayResults = new Map<string, StoredReplay>();
const replayInFlight = new Set<string>();

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Public-facing player shape (drops internal bookkeeping fields). */
function publicPlayers(room: Room): Array<Omit<LobbyPlayer, 'graceTimers'>> {
  return room.players.map((p) => ({
    id: p.id,
    player_name: p.player_name,
    user_id: p.user_id,
    is_ready: p.is_ready,
    character_id: p.character_id,
    connected: p.connected,
    socket_id: p.socket_id,
  }));
}

/** Find the live socket id for a user in a room (for targeted voice relay). */
function socketIdFor(room: Room, userId: string): string | null {
  const p = room.players.find((x) => x.user_id === userId && x.connected);
  return p ? p.socket_id : null;
}

// Allowed origins: comma-separated CORS_ORIGIN (e.g. "https://chase.example.com") in
// production; defaults to `true` (reflect any origin) for local dev / quick demos.
const corsOrigin: boolean | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;

// --- Express app (health checks + future REST endpoints) ---
const app = express();
app.use(cors({ origin: corsOrigin, credentials: true }));
app.get('/', (_req, res) => {
  res.type('text/plain').send('chase socket ok');
});
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: process.uptime(),
    ai: { ogComputeEnabled, model: OG_MODEL || null, ogStorageEnabled, ogChainEnabled, ogChainReadEnabled },
  });
});

// Phase 3 — the on-chain leaderboard, read from the ChaseLeaderboard contract. The
// results screen fetches this to render a trustless leaderboard (each row links back to
// its 0G Storage replay root hash). Empty when no contract address is configured.
app.get('/leaderboard', async (_req, res) => {
  try {
    const rows = ogChainReadEnabled ? await getRecent(10) : [];
    res.json({ enabled: ogChainReadEnabled, rows });
  } catch (err) {
    res.json({ enabled: ogChainReadEnabled, rows: [], error: (err as Error).message });
  }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});

interface SocketData {
  userId: string | null;
  roomCode: string | null;
}

io.on('connection', (socket: Socket<any, any, any, SocketData>) => {
  socket.data.userId = null;
  socket.data.roomCode = null;

  socket.on('create-room', (data: any) => {
    const roomCode = genRoomCode();
    const player: LobbyPlayer = {
      id: `p-${socket.id.slice(0, 8)}`,
      player_name: data.playerName || 'Host',
      user_id: data.userId,
      is_ready: false,
      character_id: data.characterId,
      connected: true,
      socket_id: socket.id,
    };
    rooms.set(roomCode, {
      mapId: data.mapId || 'map-1',
      isPublic: data.isPublic !== false,
      players: [player],
      hostUserId: data.userId,
      started: false,
      serverStartTime: null,
      graceTimers: new Map(),
      voiceUsers: new Set(),
    });
    socket.data.userId = data.userId;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    socket.emit('room-created', {
      roomCode,
      players: publicPlayers(rooms.get(roomCode)!),
      room: { map_id: data.mapId || 'map-1' },
    });
  });

  socket.on('join-room', (data: any) => {
    const room = rooms.get(data.roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    // Treat a join for a user already in the room as a reconnect (idempotent).
    const existing = room.players.find((p) => p.user_id === data.userId);
    if (existing) {
      const t = room.graceTimers.get(data.userId);
      if (t) { clearTimeout(t); room.graceTimers.delete(data.userId); }
      existing.connected = true;
      existing.socket_id = socket.id;
    } else {
      if (room.players.length >= 4) {
        socket.emit('error', { message: 'Room full' });
        return;
      }
      room.players.push({
        id: `p-${socket.id.slice(0, 8)}`,
        player_name: data.playerName || 'Player',
        user_id: data.userId,
        is_ready: false,
        character_id: data.characterId,
        connected: true,
        socket_id: socket.id,
      });
    }
    socket.data.userId = data.userId;
    socket.data.roomCode = data.roomCode;
    socket.join(data.roomCode);
    io.to(data.roomCode).emit('player-joined', {
      players: publicPlayers(room),
      currentPlayers: room.players.length,
    });
    socket.emit('room-joined', {
      roomCode: data.roomCode,
      players: publicPlayers(room),
      room: { map_id: room.mapId },
    });
  });

  /**
   * Reconnect / refresh recovery. The game client (a fresh socket after the
   * cross-origin handoff or a page refresh) calls this to re-attach to its room
   * without losing its slot or the in-progress match.
   */
  socket.on('rejoin-room', (data: { roomCode: string; userId: string }) => {
    const room = data?.roomCode ? rooms.get(data.roomCode) : null;
    if (!room) {
      socket.emit('rejoin-failed', { reason: 'room-gone' });
      return;
    }
    const player = room.players.find((p) => p.user_id === data.userId);
    if (!player) {
      socket.emit('rejoin-failed', { reason: 'slot-released' });
      return;
    }
    const t = room.graceTimers.get(data.userId);
    if (t) { clearTimeout(t); room.graceTimers.delete(data.userId); }
    player.connected = true;
    player.socket_id = socket.id;
    socket.data.userId = data.userId;
    socket.data.roomCode = data.roomCode;
    socket.join(data.roomCode);
    socket.emit('room-rejoined', {
      roomCode: data.roomCode,
      players: publicPlayers(room),
      room: { map_id: room.mapId },
      started: room.started,
      serverStartTime: room.serverStartTime,
    });
    socket.to(data.roomCode).emit('player-reconnected', {
      userId: data.userId,
      players: publicPlayers(room),
    });
  });

  socket.on('set-ready', ({ isReady, roomCode, userId }: { isReady: boolean; roomCode?: string; userId?: string }) => {
    const rc = roomCode || socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room) return;
    const uid = userId || socket.data.userId;
    const p = room.players.find((x) => x.user_id === uid);
    if (!p) return;
    p.is_ready = !!isReady;
    // Re-bind this socket so later events resolve even after a lobby refresh/reconnect.
    socket.data.roomCode = rc;
    socket.data.userId = uid;
    socket.join(rc);
    const readyCount = room.players.filter((x) => x.is_ready).length;
    io.to(rc).emit('room-update', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
      readyPlayers: readyCount,
    });
    io.to(rc).emit('player-ready-update', {
      players: publicPlayers(room),
      readyCount,
      totalCount: room.players.length,
    });
  });

  socket.on('start-game', () => {
    const rc = socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room) return;

    // TODO: Enable this after mechanics testing is complete
    // if (room.players.length < 2) {
    //   socket.emit('error', { message: 'Need at least 2 players to start.' });
    //   return;
    // }

    room.started = true;
    room.serverStartTime = Date.now();
    io.to(rc).emit('game-starting', { countdown: 3 });
    io.to(rc).emit('game-started', {
      serverTime: room.serverStartTime,
      players: publicPlayers(room),
      mapId: room.mapId,
    });
  });

  socket.on('get-public-rooms', () => {
    const list: Array<{ room_code: string; current_players: number; map_id: string }> = [];
    for (const [code, room] of rooms.entries()) {
      if (room.isPublic && !room.started && room.players.length < 4) {
        list.push({
          room_code: code,
          current_players: room.players.length,
          map_id: room.mapId,
        });
      }
    }
    socket.emit('public-rooms-list', list);
  });

  socket.on('get-room-state', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    socket.emit('room-state-response', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
    });
  });

  socket.on('game-state-update', (payload: any) => {
    if (payload?.roomCode) socket.to(payload.roomCode).emit('game-state-update', payload);
  });

  socket.on('player-input', (payload: any) => {
    if (payload?.roomCode) socket.to(payload.roomCode).emit('player-input', payload);
  });

  // Fill-agent positions, broadcast by the room's agent-authority client so the other
  // clients can render the 0G agents that are filling empty seats. Pure relay, like
  // player-input — the authority is the single source of truth for bot movement.
  socket.on('agent-state', (payload: any) => {
    if (payload?.roomCode) socket.to(payload.roomCode).emit('agent-state', payload);
  });

  /**
   * Agent-brain tick (the AI-native core). One client per room — the host, or the
   * solo single-player client — sends a compact world snapshot every few seconds.
   * We run ONE 0G Compute inference and broadcast the resulting intents to the whole
   * room so every client drives the agents identically. `agentTickInFlight` guards
   * against overlapping inference for the same room (and the duplicate spend that
   * would cause). `source` tells clients whether 0G is actually live → the on/off pill.
   */
  socket.on('agent-tick', async (snap: AgentSnapshot) => {
    const rc = snap?.roomCode || socket.data.roomCode;
    if (!rc) return;
    if (agentTickInFlight.has(rc)) return;
    agentTickInFlight.add(rc);
    try {
      const { intents, source } = await decideIntents({ ...snap, roomCode: rc });
      const payload = { intents, source, ogEnabled: ogComputeEnabled };
      // Reach the requesting client (single-player has no Socket.IO room) AND the
      // rest of the room (multiplayer), with no duplicate to the sender.
      socket.emit('agent-intents', payload);
      socket.to(rc).emit('agent-intents', payload);
    } catch (err) {
      console.warn('[0G] agent-tick error:', (err as Error).message);
      socket.emit('agent-intents', { intents: [], source: 'fallback', ogEnabled: ogComputeEnabled });
    } finally {
      agentTickInFlight.delete(rc);
    }
  });

  // Lightweight RTT probe for the optional in-game net-stats overlay. Echoes the
  // client's timestamp straight back so the client can measure round-trip latency.
  socket.on('ping-check', (t: number) => socket.emit('pong-check', t));

  // Authoritative egg ownership: whichever client made the new holder broadcasts the
  // egg state; everyone else mirrors it (destroys/respawns the ground egg + tints).
  socket.on('egg-state', (payload: any) => {
    if (payload?.roomCode) socket.to(payload.roomCode).emit('egg-state', payload);
  });

  socket.on('game-finished', (payload: any) => {
    if (payload?.roomCode) io.to(payload.roomCode).emit('game-finished', payload);
  });

  /**
   * Phase 2 — 0G Storage. At match end the client sends its result; we bundle it with
   * the match's REAL 0G Compute decision transcript and upload it to 0G Storage, then
   * reply with the verifiable Merkle root hash (shown on the results screen). Uploaded
   * once per room and cached, so every MP client (and a single-player solo room) gets
   * the same artifact. `roomCode` matches the agent-tick key (incl. `solo-<userId>`).
   */
  socket.on('store-replay', async (payload: { roomCode?: string; result?: any }) => {
    const rc = payload?.roomCode || socket.data.roomCode;
    if (!rc) return;

    const reply = (r: StoredReplay) => {
      socket.emit('replay-stored', r);
      socket.to(rc).emit('replay-stored', r);
    };

    // Already uploaded for this room → serve the cached artifact.
    const cached = replayResults.get(rc);
    if (cached) { reply(cached); return; }
    if (replayInFlight.has(rc)) return; // upload underway; the broadcast will reach us
    replayInFlight.add(rc);

    const transcript = getTranscript(rc);
    try {
      const bundle = {
        game: 'chase-zero',
        version: 1,
        roomCode: rc,
        finishedAt: Date.now(),
        result: payload?.result ?? null,
        // The proof the agents really reasoned on 0G: every decision, timestamped.
        aiDecisionTranscript: transcript,
        decisionCount: transcript.length,
      };
      const uploaded = ogStorageEnabled ? await uploadReplay(bundle) : null;
      if (uploaded) console.log(`[0G Storage] replay stored room=${rc} root=${uploaded.rootHash} decisions=${transcript.length}`);

      // Phase 3 — post the result on-chain, linked to the replay's storage root hash.
      let chainTxHash: string | null = null;
      if (uploaded?.rootHash && ogChainEnabled) {
        const w = payload?.result?.winner;
        const posted = await submitMatch(String(w?.name ?? 'Unknown'), Number(w?.eggHoldCount ?? 0), uploaded.rootHash);
        chainTxHash = posted?.txHash ?? null;
        if (posted) console.log(`[0G Chain] leaderboard updated room=${rc} tx=${posted.txHash}`);
      }

      const result: StoredReplay = {
        rootHash: uploaded?.rootHash ?? null,
        txHash: uploaded?.txHash ?? null,
        chainTxHash,
        transcriptLen: transcript.length,
        ogStorageEnabled,
        ogChainEnabled,
      };
      if (uploaded) replayResults.set(rc, result); // only cache a real success
      reply(result);
    } catch (err) {
      console.warn('[0G Storage] store-replay error:', (err as Error).message);
      socket.emit('replay-stored', { rootHash: null, txHash: null, chainTxHash: null, transcriptLen: transcript.length, ogStorageEnabled, ogChainEnabled });
    } finally {
      replayInFlight.delete(rc);
    }
  });

  // --- Proximity voice chat: WebRTC signalling relay (room-scoped) ---
  socket.on('voice-join', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    socket.join(`voice:${roomCode}`);
    // Tell the newcomer who's already in the voice channel so it can call them.
    const peers = [...room.voiceUsers].filter((u) => u !== userId);
    socket.emit('voice-peers', { peers });
    room.voiceUsers.add(userId);
    // Tell existing peers a new voice peer arrived (they answer incoming offers).
    socket.to(`voice:${roomCode}`).emit('voice-peer-joined', { userId });
  });

  socket.on('voice-leave', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    socket.leave(`voice:${roomCode}`);
    rooms.get(roomCode)?.voiceUsers.delete(userId);
    socket.to(`voice:${roomCode}`).emit('voice-peer-left', { userId });
  });

  // Relay an SDP/ICE message to a specific peer in the room.
  socket.on('voice-signal', (payload: { roomCode: string; from: string; to: string; data: any }) => {
    const room = payload?.roomCode ? rooms.get(payload.roomCode) : null;
    if (!room) return;
    const targetSocket = socketIdFor(room, payload.to);
    if (targetSocket) {
      io.to(targetSocket).emit('voice-signal', {
        from: payload.from,
        to: payload.to,
        data: payload.data,
      });
    }
  });

  // Explicit leave (from the lobby "Leave Room" button). Removes the player from the
  // room immediately WITHOUT tearing down the socket, so the client can create/join
  // another room afterwards.
  socket.on('leave-room', () => {
    const rc = socket.data.roomCode;
    const uid = socket.data.userId;
    socket.data.roomCode = null;
    if (!rc || !uid) return;
    socket.leave(rc);
    const room = rooms.get(rc);
    if (!room) return;
    const t = room.graceTimers.get(uid);
    if (t) { clearTimeout(t); room.graceTimers.delete(uid); }
    room.players = room.players.filter((p) => p.user_id !== uid);
    if (room.players.length === 0) {
      rooms.delete(rc);
      forgetRoom(rc);
      replayResults.delete(rc);
    } else {
      io.to(rc).emit('player-left', {
        userId: uid,
        players: publicPlayers(room),
        currentPlayers: room.players.length,
      });
    }
  });

  socket.on('disconnect', () => {
    const rc = socket.data.roomCode;
    const uid = socket.data.userId;
    if (!rc || !uid) return;
    const room = rooms.get(rc);
    if (!room) return;
    const player = room.players.find((p) => p.user_id === uid);
    // Ignore a stale socket whose slot was already taken over by a newer one.
    if (!player || player.socket_id !== socket.id) return;

    player.connected = false;
    room.voiceUsers.delete(uid);
    // Let peers show a "reconnecting" indicator and tear down voice immediately.
    io.to(rc).emit('player-disconnected', { userId: uid, players: publicPlayers(room) });
    socket.to(`voice:${rc}`).emit('voice-peer-left', { userId: uid });

    // Hold the slot open; only release it if they don't return in time.
    const existing = room.graceTimers.get(uid);
    if (existing) clearTimeout(existing);
    room.graceTimers.set(
      uid,
      setTimeout(() => {
        room.graceTimers.delete(uid);
        const stillGone = room.players.find((p) => p.user_id === uid);
        if (!stillGone || stillGone.connected) return;
        room.players = room.players.filter((p) => p.user_id !== uid);
        if (room.players.length === 0) {
          rooms.delete(rc);
        } else {
          io.to(rc).emit('player-left', {
            userId: uid,
            players: publicPlayers(room),
            currentPlayers: room.players.length,
          });
        }
      }, RECONNECT_GRACE_MS),
    );
  });
});

httpServer.listen(PORT, () => {
  console.log(`[chase-server] Express + Socket.IO listening on http://localhost:${PORT}`);
  void ogSmokeTest();
});

/**
 * Non-fatal boot check: prove the 0G Compute Router is reachable and time one
 * round-trip. Logs model + latency (verification step #1). Never throws — a failed
 * smoke test just means agents start on scripted fallback until 0G recovers.
 */
async function ogSmokeTest(): Promise<void> {
  const og = getOgClient();
  if (!og) {
    console.warn('[0G] smoke test skipped — Compute Router not configured.');
    return;
  }
  const started = Date.now();
  try {
    const r = await og.chat.completions.create(
      { model: OG_MODEL, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 16 },
      { timeout: 8000, maxRetries: 0 },
    );
    const reply = r.choices?.[0]?.message?.content?.trim() ?? '';
    console.log(`[0G] Compute reachable ✓ model=${OG_MODEL} latency=${Date.now() - started}ms reply="${reply}"`);
  } catch (err) {
    console.warn(`[0G] Compute smoke test FAILED (${Date.now() - started}ms):`, (err as Error).message);
  }
}
