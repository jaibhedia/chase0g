import { useEffect, useState } from 'react';

/**
 * Single source of truth for "is this a touch device" across the in-game HUD + controls.
 * Previously GameHUD and MobileControls computed this differently (GameHUD added a UA
 * check, MobileControls didn't), so on phones/tablets + the devtools device emulator they
 * disagreed — rendering the desktop HUD AND the touch controls at once (overlaps, a
 * doubled power-up). One hook = one answer everywhere.
 *
 * Counts as touch when EITHER the primary pointer is coarse + touch-capable (real phones
 * and iPads — incl. iPads that UA-report as "Macintosh"), OR the UA is a known mobile OS
 * (covers Chrome's device-mode emulator, which doesn't always flip `pointer: coarse`).
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
      const uaMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsTouch((coarse && hasTouch) || uaMobile);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    const mq = window.matchMedia?.('(pointer: coarse)');
    mq?.addEventListener?.('change', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      mq?.removeEventListener?.('change', check);
    };
  }, []);

  return isTouch;
}
