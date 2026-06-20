import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

type Props = {
  powerUpReady: boolean;
  powerUpActive: boolean;
  powerUpCooldown: number;
  cooldownMax: number;
  /** How long the power stays active (ms) — drives the deplete animation. */
  activeDuration?: number;
  onActivate: () => void;
  /** Diameter in px. Lets the same button scale across phone/tablet/desktop. */
  size?: number;
};

/**
 * Self-contained power-up button. One circular control that cycles:
 *   charging (ring fills) → READY (glows, tappable) → ACTIVE (ring drains) → dark → repeat.
 * No separate "GO" button — the ring + glow IS the affordance, on touch and desktop alike.
 */
export function PowerUpHudCluster({
  powerUpReady,
  powerUpActive,
  powerUpCooldown,
  cooldownMax,
  activeDuration = 3000,
  onActivate,
  size = 76,
}: Props) {
  const stroke = Math.max(4, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  const cooldownSeconds = Math.ceil(Math.max(0, powerUpCooldown) / 1000);
  const charging = powerUpCooldown > 0 && !powerUpReady && !powerUpActive;
  const tappable = powerUpReady && !powerUpActive;

  // Ring fill fraction (0..1) + the CSS transition time used to animate toward it.
  const [ring, setRing] = useState({ frac: 0, ms: 200 });

  useEffect(() => {
    if (powerUpActive) {
      // Snap to full, then drain to empty across the active duration (the "deplete").
      setRing({ frac: 1, ms: 0 });
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() =>
          setRing({ frac: 0, ms: Math.max(300, activeDuration) })
        );
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (powerUpReady) {
      setRing({ frac: 1, ms: 220 });
      return;
    }
    if (charging && cooldownMax > 0) {
      // Fill toward 1 as the cooldown counts down. The engine ticks cooldown ~once a
      // second, so a ~1s linear transition smooths the ring between ticks.
      const frac = Math.max(0, Math.min(1, 1 - powerUpCooldown / cooldownMax));
      setRing({ frac, ms: 1000 });
      return;
    }
    // Warming up before the first unlock — dark/empty.
    setRing({ frac: 0, ms: 300 });
  }, [powerUpActive, powerUpReady, charging, powerUpCooldown, cooldownMax, activeDuration]);

  const ringColor = powerUpActive ? '#5fcde4' : powerUpReady ? '#ffc93c' : '#c97b3c';
  const status = powerUpActive
    ? 'Active'
    : powerUpReady
      ? 'Ready'
      : charging
        ? `${cooldownSeconds}s`
        : 'Charging';

  const innerBg = powerUpActive
    ? 'radial-gradient(circle at 35% 30%, #7fe3f5, #2aa6c9)'
    : powerUpReady
      ? 'radial-gradient(circle at 35% 30%, #ffe08a, #e0a02c)'
      : 'radial-gradient(circle at 35% 30%, #3a2a18, #241608)';
  const iconColor = powerUpReady ? '#2b2410' : powerUpActive ? '#06262f' : '#c9a978';

  return (
    <div className="flex select-none flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Pulsing aura when usable / firing. */}
        {(powerUpReady || powerUpActive) && (
          <motion.div
            className="pointer-events-none absolute -inset-1 rounded-full"
            style={{ border: `2px solid ${ringColor}` }}
            animate={{ scale: [1, 1.16, 1], opacity: [0.7, 0.15, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Progress ring (rotated so it fills from the top, clockwise). */}
        <svg
          className="pointer-events-none absolute inset-0 -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={stroke} />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ring.frac)}
            style={{ transition: `stroke-dashoffset ${ring.ms}ms linear, stroke 200ms ease` }}
          />
        </svg>

        <motion.button
          type="button"
          aria-label="Activate power-up"
          disabled={!tappable}
          onMouseDown={(e) => { e.preventDefault(); if (tappable) onActivate(); }}
          onTouchStart={(e) => { e.preventDefault(); if (tappable) onActivate(); }}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            inset: stroke + 3,
            background: innerBg,
            boxShadow: tappable
              ? `0 0 14px ${ringColor}, inset 0 -3px 6px rgba(0,0,0,0.4)`
              : 'inset 0 -3px 6px rgba(0,0,0,0.45)',
            border: '2px solid rgba(17,17,28,0.85)',
            opacity: charging ? 0.92 : 1,
            cursor: tappable ? 'pointer' : 'default',
          }}
          animate={tappable ? { y: [0, -2, 0] } : { y: 0 }}
          transition={{ duration: 1.1, repeat: tappable ? Infinity : 0, ease: 'easeInOut' }}
          whileTap={tappable ? { scale: 0.92 } : undefined}
        >
          {charging ? (
            <span
              className="px-heading tabular-nums"
              style={{ color: iconColor, fontSize: Math.round(size * 0.26), lineHeight: 1 }}
            >
              {cooldownSeconds}
            </span>
          ) : (
            <Zap
              style={{ width: size * 0.4, height: size * 0.4, color: iconColor }}
              fill={powerUpReady || powerUpActive ? iconColor : 'none'}
            />
          )}
        </motion.button>
      </div>

      <span
        className="px-heading uppercase tracking-wide tabular-nums"
        style={{ color: ringColor, fontSize: Math.max(7, Math.round(size * 0.11)) }}
      >
        {status}
      </span>
    </div>
  );
}
