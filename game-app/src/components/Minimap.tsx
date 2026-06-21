import { useGameStore } from '@/store/gameStore';

/**
 * Top-down minimap of the arena. Reads the throttled `minimap` slice from the store
 * (fed ~12Hz by the scene) so it re-renders independently of the rest of the HUD.
 * DOM/SVG — always on top of the canvas, no Phaser camera-zoom math.
 */
export function Minimap({ isMobile = false }: { isMobile?: boolean }) {
  const minimap = useGameStore((s) => s.minimap);
  const gameObjects = useGameStore((s) => s.gameObjects);
  if (!minimap.w || !minimap.h || minimap.dots.length === 0) return null;

  // Compact on touch so it tucks into the top-right and never collides with the joystick
  // (bottom-right) or the power-up button (bottom-left).
  const W = isMobile ? 96 : 196;
  const H = isMobile
    ? Math.max(54, Math.round(W * (minimap.h / minimap.w)))
    : Math.round(Math.min(150, Math.max(96, W * (minimap.h / minimap.w))));
  const sx = W / minimap.w;
  const sy = H / minimap.h;

  // Desktop: full size, bottom-right. Touch: compact, top-right (below the menu + voice
  // buttons), out of both thumb zones.
  const wrapCls = isMobile
    ? 'pointer-events-none fixed top-32 right-2 z-[54] px-panel p-1'
    : 'pointer-events-none fixed bottom-6 right-6 z-[55] px-panel p-2';

  return (
    <div className={wrapCls}>
      {!isMobile && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">Map</span>
        </div>
      )}
      <svg
        width={W}
        height={H}
        className="block"
        style={{ imageRendering: 'pixelated', display: 'block' }}
      >
        {/* arena floor + frame */}
        <rect x={0} y={0} width={W} height={H} fill="#1d3322" />

        {/* map preview — obstacles (trees/bushes/props) as darker foliage clumps */}
        {gameObjects.map((o, i) => (
          <rect
            key={`o-${i}`}
            x={o.x * sx}
            y={o.y * sy}
            width={Math.max(1.5, o.width * sx)}
            height={Math.max(1.5, o.height * sy)}
            rx={1}
            fill="#16291a"
            opacity={0.9}
          />
        ))}

        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="#3e5e3e" strokeWidth={1} />

        {minimap.dots.map((d, i) => {
          const cx = Math.max(4, Math.min(W - 4, d.x * sx));
          const cy = Math.max(4, Math.min(H - 4, d.y * sy));
          if (d.kind === 'egg') {
            // Egg = gold diamond so it stands out from the round player blips.
            const r = 4.5;
            return (
              <rect
                key={i}
                x={cx - r}
                y={cy - r}
                width={r * 2}
                height={r * 2}
                fill="#facc15"
                stroke="#7a5b16"
                strokeWidth={1}
                transform={`rotate(45 ${cx} ${cy})`}
              />
            );
          }
          const r = d.kind === 'self' ? 4 : 3.2;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={d.color}
              stroke={d.kind === 'self' ? '#ffffff' : '#0b1120'}
              strokeWidth={d.kind === 'self' ? 1.6 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}
