/**
 * Proximity voice chat over a WebRTC mesh.
 *
 * Signalling is relayed by the game server (`voice-*` events). To avoid offer
 * "glare", the rule is simple: the NEWCOMER always initiates the call. When we
 * join we receive the list of existing peers (`voice-peers`) and place an offer
 * to each; existing peers learn of us via `voice-peer-joined` and simply answer
 * the offer we send.
 *
 * "Proximity": each remote peer gets its own <audio> element whose volume is
 * driven every frame by the in-game distance between the two players, so people
 * standing near you are loud and distant players fade to silence — like Among
 * Us / Gather. If a peer's position isn't known yet we fall back to full volume
 * so the channel is still usable.
 */
import type { Socket } from 'socket.io-client';

export interface VoicePositionSource {
  getLocalPosition: () => { x: number; y: number } | null;
  getPeerPosition: (userId: string) => { x: number; y: number } | null;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface ProximityVoiceOpts {
  socket: Socket;
  roomCode: string;
  localUserId: string;
  positions: VoicePositionSource;
  /** Within this many px the peer is at full volume. */
  minDistance?: number;
  /** Beyond this many px the peer is silent. */
  maxDistance?: number;
  onPeersChanged?: (count: number) => void;
}

export class ProximityVoice {
  private socket: Socket;
  private roomCode: string;
  private localUserId: string;
  private positions: VoicePositionSource;
  private minDistance: number;
  private maxDistance: number;
  private onPeersChanged?: (count: number) => void;

  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private rafId: number | null = null;
  private muted = false;
  private running = false;

  constructor(opts: ProximityVoiceOpts) {
    this.socket = opts.socket;
    this.roomCode = opts.roomCode;
    this.localUserId = opts.localUserId;
    this.positions = opts.positions;
    this.minDistance = opts.minDistance ?? 140;
    this.maxDistance = opts.maxDistance ?? 520;
    this.onPeersChanged = opts.onPeersChanged;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.running = true;

    this.socket.on('voice-peers', this.handleVoicePeers);
    this.socket.on('voice-peer-joined', this.handlePeerJoined);
    this.socket.on('voice-peer-left', this.handlePeerLeft);
    this.socket.on('voice-signal', this.handleSignal);

    this.socket.emit('voice-join', { roomCode: this.roomCode, userId: this.localUserId });
    this.loop();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;

    this.socket.off('voice-peers', this.handleVoicePeers);
    this.socket.off('voice-peer-joined', this.handlePeerJoined);
    this.socket.off('voice-peer-left', this.handlePeerLeft);
    this.socket.off('voice-signal', this.handleSignal);
    this.socket.emit('voice-leave', { roomCode: this.roomCode, userId: this.localUserId });

    for (const [, entry] of this.peers) this.teardownEntry(entry);
    this.peers.clear();
    this.onPeersChanged?.(0);

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }

  isMuted(): boolean {
    return this.muted;
  }

  // --- signalling handlers (arrow fns so `this` binds for on/off) ---

  private handleVoicePeers = ({ peers }: { peers: string[] }) => {
    // We're the newcomer: place an offer to everyone already here.
    for (const peerId of peers) {
      if (peerId === this.localUserId) continue;
      void this.callPeer(peerId);
    }
  };

  private handlePeerJoined = (_data: { userId: string }) => {
    // A newcomer will send us an offer; nothing to do until then.
  };

  private handlePeerLeft = ({ userId }: { userId: string }) => {
    const entry = this.peers.get(userId);
    if (entry) {
      this.teardownEntry(entry);
      this.peers.delete(userId);
      this.onPeersChanged?.(this.peers.size);
    }
  };

  private handleSignal = async ({ from, data }: { from: string; data: any }) => {
    try {
      let entry = this.peers.get(from);
      if (!entry) entry = this.createPeer(from, false);
      const pc = entry.pc;
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        if (data.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signal(from, pc.localDescription);
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    } catch (err) {
      console.warn('[voice] signal error', err);
    }
  };

  // --- peer connection plumbing ---

  private createPeer(peerId: string, _initiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    const audio = new Audio();
    audio.autoplay = true;
    (audio as any).playsInline = true;
    audio.volume = 0;

    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(peerId, e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      audio.play().catch(() => { /* resumes after a user gesture */ });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handlePeerLeft({ userId: peerId });
      }
    };

    const entry: PeerEntry = { pc, audio };
    this.peers.set(peerId, entry);
    this.onPeersChanged?.(this.peers.size);
    return entry;
  }

  private async callPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) return;
    const entry = this.createPeer(peerId, true);
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      this.signal(peerId, entry.pc.localDescription);
    } catch (err) {
      console.warn('[voice] offer error', err);
    }
  }

  private signal(to: string, data: any): void {
    this.socket.emit('voice-signal', {
      roomCode: this.roomCode,
      from: this.localUserId,
      to,
      data,
    });
  }

  private teardownEntry(entry: PeerEntry): void {
    try { entry.pc.close(); } catch { /* ignore */ }
    entry.audio.srcObject = null;
  }

  // --- proximity volume loop ---

  private loop = () => {
    if (!this.running) return;
    const me = this.positions.getLocalPosition();
    for (const [peerId, entry] of this.peers) {
      const them = this.positions.getPeerPosition(peerId);
      let volume = 1;
      if (me && them) {
        const dist = Math.hypot(me.x - them.x, me.y - them.y);
        if (dist <= this.minDistance) volume = 1;
        else if (dist >= this.maxDistance) volume = 0;
        else {
          const t = (dist - this.minDistance) / (this.maxDistance - this.minDistance);
          volume = 1 - t * t; // gentle quadratic falloff
        }
      }
      entry.audio.volume = volume;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}
