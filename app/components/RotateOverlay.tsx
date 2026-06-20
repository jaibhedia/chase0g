'use client';

import { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

/**
 * App-wide "please rotate to landscape" gate. Shows ONLY on touch devices
 * (phones + tablets) held in portrait — desktops/laptops with a mouse are never
 * blocked. The game is landscape-only, so this keeps every shell screen consistent
 * with the PWA manifest's `orientation: landscape`.
 */
export function RotateOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const isTouch =
        (window.matchMedia?.('(pointer: coarse)').matches ?? false) &&
        (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0);
      const isPortrait = window.innerHeight > window.innerWidth;
      setShow(isTouch && isPortrait);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-center"
      style={{ background: '#14140f' }}
      aria-live="assertive"
      role="alertdialog"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <Smartphone className="w-16 h-16 text-[#ffc93c]" style={{ animation: 'rotateHint 1.6s ease-in-out infinite' }} />
          <RotateCw className="absolute -right-3 -top-3 w-6 h-6 text-[#6ab04c]" />
        </div>
        <h2 className="px-heading text-lg uppercase tracking-widest" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
          Rotate to landscape
        </h2>
        <p className="text-[#f4e7c3] text-sm max-w-xs">
          Chase is played in landscape. Turn your device sideways to play.
        </p>
      </div>
      <style>{`
        @keyframes rotateHint {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  );
}
