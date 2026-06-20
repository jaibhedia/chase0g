import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';

/**
 * Tiny top-left diagnostic overlay: network round-trip time (RTT) + render FPS.
 * Lets you tell network lag (high RTT) from render lag (low FPS) at a glance.
 *
 * Visibility:
 *   - Build-time default: VITE_SHOW_NETSTATS=true (inlined by Vite).
 *   - Runtime override (no rebuild needed): add ?netstats=1 to the URL to force
 *     on (?netstats=0 to force off); the choice is remembered in localStorage.
 */
function resolveVisible(): boolean {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('netstats');
    if (q != null) {
      const on = q === '1' || q === 'true';
      try { localStorage.setItem('chase-netstats', on ? '1' : '0'); } catch { /* ignore */ }
      return on;
    }
    try {
      const ls = localStorage.getItem('chase-netstats');
      if (ls === '1') return true;
      if (ls === '0') return false;
    } catch { /* ignore */ }
  }
  const env = import.meta.env.VITE_SHOW_NETSTATS;
  return env === 'true' || env === '1';
}

/** Color a value against good/ok thresholds (higher-is-worse). */
function band(value: number, good: number, ok: number): string {
  if (value <= good) return '#6ab04c'; // grass
  if (value <= ok) return '#ffc93c';   // sun
  return '#e8503a';                    // danger
}

export default function NetStats() {
  const [visible] = useState(resolveVisible);
  const { socket, connectionStatus } = useSocket();
  const [rtt, setRtt] = useState<number | null>(null);
  const [fps, setFps] = useState(0);
  const rttRef = useRef<number | null>(null);

  // RTT probe: emit a timestamp once a second, server echoes it back.
  useEffect(() => {
    if (!visible || !socket) return;
    const onPong = (t0: number) => {
      const ms = Math.max(0, Math.round(performance.now() - t0));
      rttRef.current = ms;
      setRtt(ms);
    };
    socket.on('pong-check', onPong);
    const ping = () => { if (socket.connected) socket.emit('ping-check', performance.now()); };
    ping();
    const id = setInterval(ping, 1000);
    return () => { clearInterval(id); socket.off('pong-check', onPong); };
  }, [visible, socket]);

  // FPS: sample requestAnimationFrame over ~500ms windows.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  const connected = connectionStatus === 'connected';
  const rttLabel = !connected ? '—' : rtt == null ? '…' : `${rtt}ms`;
  const rttColor = !connected || rtt == null ? '#9aa0b4' : band(rtt, 80, 160);
  const fpsColor = band(60 - fps, 10, 30); // 60→good, 30→ok, lower→bad

  return (
    <div
      className="fixed top-2 left-2 z-[70] px-panel flex flex-col gap-0.5 px-2.5 py-1.5 pointer-events-none select-none"
      style={{ minWidth: 88 }}
    >
      <div className="flex items-center justify-between gap-3 px-heading text-[9px] uppercase tracking-wider">
        <span style={{ color: '#9aa0b4' }}>RTT</span>
        <span style={{ color: rttColor }}>{rttLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-heading text-[9px] uppercase tracking-wider">
        <span style={{ color: '#9aa0b4' }}>FPS</span>
        <span style={{ color: fpsColor }}>{fps || '…'}</span>
      </div>
    </div>
  );
}
