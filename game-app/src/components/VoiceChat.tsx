import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Headphones } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/gameStore';
import { ProximityVoice } from '@/lib/voiceChat';

/**
 * Opt-in proximity voice chat control. Available only in multiplayer rooms.
 * Tapping "Voice" requests the mic and joins the room's WebRTC mesh; nearby
 * players come through loud and distant ones fade out (see ProximityVoice).
 */
export default function VoiceChat() {
  const { socket, connectionStatus } = useSocket();
  const gameMode = useGameStore((s) => s.gameMode);
  const roomCode = useGameStore((s) => s.roomCode);
  const userId = useGameStore((s) => s.userId);

  const voiceRef = useRef<ProximityVoice | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState('');

  // Tear down on unmount.
  useEffect(() => () => { voiceRef.current?.stop(); voiceRef.current = null; }, []);

  // Voice needs an online room with a stable user id.
  if (gameMode !== 'multiplayer' || !roomCode || !userId) return null;

  const enable = async () => {
    if (!socket) return;
    setError('');
    const voice = new ProximityVoice({
      socket,
      roomCode,
      localUserId: userId,
      onPeersChanged: setPeerCount,
      positions: {
        getLocalPosition: () => {
          const p = useGameStore.getState().players.find((x) => x.userId === userId);
          return p ? { x: p.x, y: p.y } : null;
        },
        getPeerPosition: (peerId) => {
          const p = useGameStore.getState().players.find((x) => x.userId === peerId);
          return p ? { x: p.x, y: p.y } : null;
        },
      },
    });
    try {
      await voice.start();
      voiceRef.current = voice;
      setActive(true);
      setMuted(false);
    } catch (err: any) {
      console.warn('[voice] failed to start', err);
      setError(err?.name === 'NotAllowedError' ? 'Mic blocked' : 'Mic unavailable');
    }
  };

  const disable = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setActive(false);
    setPeerCount(0);
  };

  const toggleMute = () => {
    const next = !muted;
    voiceRef.current?.setMuted(next);
    setMuted(next);
  };

  return (
    <div
      className="pointer-events-auto fixed top-16 z-[58] flex flex-col items-end gap-1.5 sm:top-20 sm:gap-2"
      style={{ right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)' }}
    >
      {!active ? (
        <button
          onClick={enable}
          disabled={connectionStatus !== 'connected'}
          className="px-chip flex items-center gap-1.5 p-1.5 transition-all hover:brightness-110 disabled:opacity-50 sm:gap-2 sm:p-2.5"
          aria-label="Join proximity voice chat"
        >
          <Headphones className="h-4 w-4 text-[#5fcde4] sm:h-5 sm:w-5" />
          <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3] sm:text-[9px]">Voice</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="px-chip flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#6ab04c] animate-pulse" />
            <span className="px-heading text-[8px] tabular-nums text-[#f4e7c3] sm:text-[9px]">{peerCount}</span>
          </div>
          <button
            onClick={toggleMute}
            className="px-chip p-1.5 transition-all hover:brightness-110 sm:p-2.5"
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? (
              <MicOff className="h-4 w-4 text-[#e8503a] sm:h-5 sm:w-5" />
            ) : (
              <Mic className="h-4 w-4 text-[#6ab04c] sm:h-5 sm:w-5" />
            )}
          </button>
          <button
            onClick={disable}
            className="px-chip p-1.5 transition-all hover:brightness-110 sm:p-2.5"
            aria-label="Leave voice chat"
          >
            <PhoneOff className="h-4 w-4 text-[#e8503a] sm:h-5 sm:w-5" />
          </button>
        </div>
      )}
      {error && (
        <span className="px-heading text-[8px] uppercase tracking-wider text-[#e8503a]">{error}</span>
      )}
    </div>
  );
}
