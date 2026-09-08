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
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server, type Socket } from 'socket.io';
import { decideIntents, forgetRoom, getTranscript, type AgentSnapshot } from './agents/agentBrain';
import { aiEnabled, getAiClient, AI_MODEL, aiProviderName } from './ai/provider';
import { uploadReplay, ogStorageEnabled } from './og/storage';
import { submitMatch, getRecent, ogChainEnabled, ogChainReadEnabled } from './og/chain';
import { settleMatch, getArcMatch, arcEnabled, arcReadEnabled } from './arc/chaseStake';

const PORT = Number(process.env.SOCKET_PORT || process.env.PORT || 3001);
/** How long a disconnected player's slot is held open for them to come back. */
const RECONNECT_GRACE_MS = 30_000;

interface LobbyPlayer {
  id: string;
  player_name: string;
  user_id: string;
  is_ready: boolean;
  /** Numeric character index (1-4) the client derives from the selected character. */
  character_id: number;
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
interface StoredReplay { rootHash: string | null; txHash: string | null; chainTxHash: string | null; transcriptLen: number; ogStorageEnabled: boolean; ogChainEnabled: boolean; arcTxHash: string | null; arcPot: string | null; arcExplorer: string | null; }
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

/** True if `characterId` is already claimed by another player in the room. With 4
 *  characters and 4 max players, every player can hold a distinct one. */
function characterTaken(room: Room, characterId: unknown, exceptUserId?: string): boolean {
  const cid = Number(characterId);
  return room.players.some((p) => p.user_id !== exceptUserId && Number(p.character_id) === cid);
}

/** The player's preferred character if free, else the first unclaimed one (1-4). Used to
 *  auto-resolve a duplicate pick at join time so a join never fails on a clash. */
function resolveCharacter(room: Room, preferred: unknown): number {
  const pref = Number(preferred) || 1;
  if (!characterTaken(room, pref)) return pref;
  for (let i = 1; i <= 4; i++) if (!characterTaken(room, i)) return i;
  return pref;
}

// --- Abuse / DoS guards -----------------------------------------------------
/** Hard cap on concurrent rooms — bounds the in-memory store against a create-spam
 *  memory-exhaustion DoS. */
const MAX_ROOMS = 1000;
const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;

/** Clamp an untrusted string to a max length (drops payload-bloat griefing). */
function cleanStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
/** Finite number clamped to a sane range (drops NaN/Infinity/absurd coordinates). */
function cleanNum(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/** True only if this socket is a live member of a real `roomCode` — the core guard that
 *  stops a client spoofing/griefing a room it never joined. */
function isRoomMember(socket: Socket<any, any, any, SocketData>, roomCode: unknown): roomCode is string {
  if (typeof roomCode !== 'string' || !ROOM_CODE_RE.test(roomCode)) return false;
  if (socket.data.roomCode !== roomCode) return false;
  const room = rooms.get(roomCode);
  return !!room && room.players.some((p) => p.user_id === socket.data.userId);
}

/** Membership guard that also allows a single-player `solo-<userId>` room (which has no
 *  Socket.IO fan-out, so it can't reach anyone else). Used by relay handlers that both
 *  single-player and multiplayer emit (agent-tick, store-replay, game-finished). */
function canUseRoom(socket: Socket<any, any, any, SocketData>, roomCode: unknown): roomCode is string {
  if (typeof roomCode === 'string' && roomCode.startsWith('solo-')) return true;
  return isRoomMember(socket, roomCode);
}

/** Sliding-window per-socket rate limiter (keyed by socket id + action) — throttles room
 *  create/join floods. Entries are cleared on disconnect. */
const recentActions = new Map<string, number[]>();
function rateOk(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (recentActions.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { recentActions.set(key, arr); return false; }
  arr.push(now);
  recentActions.set(key, arr);
  return true;
}

// Allowed origins: comma-separated CORS_ORIGIN (e.g. "https://chase.example.com") in
// production; defaults to `true` (reflect any origin) for local dev / quick demos.
const corsOrigin: boolean | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;

// In production, reflecting any origin is a real risk — make the misconfig loud.
if (process.env.NODE_ENV === 'production' && corsOrigin === true) {
  console.warn('[security] CORS_ORIGIN is unset in production — reflecting ANY origin. Set CORS_ORIGIN to your site(s).');
}

// --- Express app (health checks + future REST endpoints) ---
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
// Basic abuse guard on the HTTP routes (the socket has its own per-action limiter).
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.get('/', (_req, res) => {
  res.type('text/plain').send('chase socket ok');
});
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: process.uptime(),
    ai: { enabled: aiEnabled, provider: aiProviderName, model: AI_MODEL || null, ogStorageEnabled, ogChainEnabled, ogChainReadEnabled },
    arc: { enabled: arcEnabled, readEnabled: arcReadEnabled },
  });
});

// Arc — live escrow state for a room, so the lobby can show the pot building up and the
// results screen can link the payout. Returns { staked: false } for Free Play rooms,
// which have no on-chain match at all.
app.get('/arc/match/:roomCode', async (req, res) => {
  const roomCode = String(req.params.roomCode || '').slice(0, 32);
  if (!arcReadEnabled) { res.json({ enabled: false, staked: false, match: null }); return; }
  try {
    const match = await getArcMatch(roomCode);
    res.json({ enabled: true, staked: !!match, match });
  } catch (err) {
    res.json({ enabled: true, staked: false, match: null, error: (err as Error).message });
  }
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
  // Game/lobby payloads are tiny; cap the frame size to mitigate the socket.io
  // unbounded-binary-attachment advisory + memory-exhaustion via giant frames.
  maxHttpBufferSize: 1e5, // 100 KB
});

interface SocketData {
  userId: string | null;
  roomCode: string | null;
}

io.on('connection', (socket: Socket<any, any, any, SocketData>) => {
  socket.data.userId = null;
  socket.data.roomCode = null;

  socket.on('create-room', (data: any) => {
    if (rooms.size >= MAX_ROOMS) {
      socket.emit('error', { message: 'Server is at capacity, try again shortly.' });
      return;
    }
    if (!rateOk(`${socket.id}:create`, 10, 60_000)) {
      socket.emit('error', { message: 'Slow down — too many rooms created.' });
      return;
    }
    if (typeof data?.userId !== 'string' || !data.userId) {
      socket.emit('error', { message: 'Invalid session.' });
      return;
    }
    const roomCode = genRoomCode();
    const player: LobbyPlayer = {
      id: `p-${socket.id.slice(0, 8)}`,
      player_name: cleanStr(data.playerName, 24) || 'Host',
      user_id: data.userId,
      is_ready: false,
      character_id: cleanNum(data.characterId, 1, 4) || 1,
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
    if (!rateOk(`${socket.id}:join`, 30, 60_000)) {
      socket.emit('error', { message: 'Slow down — too many join attempts.' });
      return;
    }
    if (typeof data?.userId !== 'string' || !data.userId || typeof data?.roomCode !== 'string') {
      socket.emit('error', { message: 'Invalid join request.' });
      return;
    }
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
      // Auto-resolve a duplicate character pick to the first free one so the join
      // never fails on a clash; the lobby picker lets them swap afterwards.
      room.players.push({
        id: `p-${socket.id.slice(0, 8)}`,
        player_name: cleanStr(data.playerName, 24) || 'Player',
        user_id: data.userId,
        is_ready: false,
        character_id: resolveCharacter(room, data.characterId),
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

  // Lobby character swap. The server is the single source of truth for who holds which
  // character: reject if another player already claimed it (race), else apply + broadcast.
  socket.on('set-character', ({ roomCode, userId, characterId, playerName }: { roomCode?: string; userId?: string; characterId: number; playerName?: string }) => {
    const rc = roomCode || socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room || room.started) return; // locked once the match begins
    const uid = userId || socket.data.userId;
    if (!uid) return;
    const p = room.players.find((x) => x.user_id === uid);
    if (!p) return;
    if (characterTaken(room, characterId, uid)) {
      socket.emit('character-taken', { characterId: Number(characterId) });
      return;
    }
    p.character_id = Number(characterId);
    if (playerName) p.player_name = playerName; // name mirrors the character
    socket.data.roomCode = rc;
    socket.data.userId = uid;
    socket.join(rc);
    io.to(rc).emit('room-update', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
      readyPlayers: room.players.filter((x) => x.is_ready).length,
    });
    io.to(rc).emit('player-joined', { players: publicPlayers(room), currentPlayers: room.players.length });
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
    if (!isRoomMember(socket, payload?.roomCode)) return;
    socket.to(payload.roomCode).emit('game-state-update', payload);
  });

  socket.on('player-input', (payload: any) => {
    // Membership-gated + re-built from sanitized fields so a peer can't inject junk.
    if (!isRoomMember(socket, payload?.roomCode)) return;
    socket.to(payload.roomCode).emit('player-input', {
      roomCode: payload.roomCode,
      userId: cleanStr(payload.userId, 64),
      x: cleanNum(payload.x, -1e5, 1e5),
      y: cleanNum(payload.y, -1e5, 1e5),
      vx: cleanNum(payload.vx, -1e5, 1e5),
      vy: cleanNum(payload.vy, -1e5, 1e5),
      hasEgg: !!payload.hasEgg,
      isInvincible: !!payload.isInvincible,
    });
  });

  // Fill-agent positions, broadcast by the room's agent-authority client so the other
  // clients can render the 0G agents that are filling empty seats. Pure relay, like
  // player-input — the authority is the single source of truth for bot movement.
  socket.on('agent-state', (payload: any) => {
    if (!isRoomMember(socket, payload?.roomCode)) return;
    socket.to(payload.roomCode).emit('agent-state', payload);
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
    if (!canUseRoom(socket, rc)) return;
    if (agentTickInFlight.has(rc)) return;
    agentTickInFlight.add(rc);
    try {
      const { intents, source } = await decideIntents({ ...snap, roomCode: rc });
      const payload = { intents, source, ogEnabled: aiEnabled, aiProvider: aiProviderName };
      // Reach the requesting client (single-player has no Socket.IO room) AND the
      // rest of the room (multiplayer), with no duplicate to the sender.
      socket.emit('agent-intents', payload);
      socket.to(rc).emit('agent-intents', payload);
    } catch (err) {
      console.warn('[0G] agent-tick error:', (err as Error).message);
      socket.emit('agent-intents', { intents: [], source: 'fallback', ogEnabled: aiEnabled, aiProvider: aiProviderName });
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
    if (!isRoomMember(socket, payload?.roomCode)) return;
    socket.to(payload.roomCode).emit('egg-state', payload);
  });

  socket.on('game-finished', (payload: any) => {
    if (!canUseRoom(socket, payload?.roomCode)) return;
    io.to(payload.roomCode).emit('game-finished', payload);
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
    if (!canUseRoom(socket, rc)) return;

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

      // Phase 3 — post the result on-chain. Decoupled from Storage: the leaderboard
      // records the winner even when the replay upload failed (Storage testnet flake),
      // just with an empty rootHash for that row. Storage success links the row to its
      // verifiable replay; either way the deployed leaderboard stays populated.
      let chainTxHash: string | null = null;
      if (ogChainEnabled) {
        const w = payload?.result?.winner;
        const posted = await submitMatch(String(w?.name ?? 'Unknown'), Number(w?.eggHoldCount ?? 0), uploaded?.rootHash ?? '');
        chainTxHash = posted?.txHash ?? null;
        if (posted) console.log(`[0G Chain] leaderboard updated room=${rc} tx=${posted.txHash}${uploaded?.rootHash ? '' : ' (no replay hash — Storage unavailable)'}`);
      }

      // Arc — pay out the USDC pot for ranked matches. Safe to call unconditionally:
      // a Free Play room has no on-chain match, so this no-ops. The replay root links
      // the payout to the recorded match and its AI decision transcript.
      const settled = await settleMatch(rc, payload?.result?.winner?.address, uploaded?.rootHash ?? '');

      const result: StoredReplay = {
        rootHash: uploaded?.rootHash ?? null,
        txHash: uploaded?.txHash ?? null,
        chainTxHash,
        transcriptLen: transcript.length,
        ogStorageEnabled,
        ogChainEnabled,
        arcTxHash: settled?.txHash ?? null,
        arcPot: settled?.pot ?? null,
        arcExplorer: settled?.explorer ?? null,
      };
      // Cache once we have a durable artifact (a stored replay, an on-chain row, or a
      // settled pot) so we don't re-submit for the same room.
      if (uploaded || chainTxHash || settled) replayResults.set(rc, result);
      reply(result);
    } catch (err) {
      console.warn('[0G Storage] store-replay error:', (err as Error).message);
      socket.emit('replay-stored', { rootHash: null, txHash: null, chainTxHash: null, transcriptLen: transcript.length, ogStorageEnabled, ogChainEnabled, arcTxHash: null, arcPot: null, arcExplorer: null });
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
    recentActions.delete(`${socket.id}:create`);
    recentActions.delete(`${socket.id}:join`);
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

// Fail clean on a busy port (a leftover dev instance) instead of dumping an unhandled
// 'error' event stack trace. The tsx watcher restarts; one clear line is enough.
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[chase-server] Port ${PORT} is already in use — another instance is running. Free it with: npx kill-port ${PORT}`);
    process.exit(1);
  }
  throw err;
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
  const og = getAiClient();
  if (!og) {
    console.warn('[0G] smoke test skipped — Compute Router not configured.');
    return;
  }
  const started = Date.now();
  try {
    const r = await og.chat.completions.create(
      { model: AI_MODEL, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 16 },
      { timeout: 8000, maxRetries: 0 },
    );
    const reply = r.choices?.[0]?.message?.content?.trim() ?? '';
    console.log(`[ai] ${aiProviderName} reachable ✓ model=${AI_MODEL} latency=${Date.now() - started}ms reply="${reply}"`);
  } catch (err) {
    console.warn(`[0G] Compute smoke test FAILED (${Date.now() - started}ms):`, (err as Error).message);
  }
}
