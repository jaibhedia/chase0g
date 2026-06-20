import { useGameStore } from '@/store/gameStore';

/**
 * Top-down minimap of the arena. Reads the throttled `minimap` slice from the store
 * (fed ~12Hz by the scene) so it re-renders independently of the rest of the HUD.
 * DOM/SVG — always on top of the canvas, no Phaser camera-zoom math.
 */
export function Minimap() {
  const minimap = useGameStore((s) => s.minimap);
  if (!minimap.w || !minimap.h || minimap.dots.length === 0) return null;

  const W = 150;
  const H = Math.max(70, Math.round(W * (minimap.h / minimap.w)));
  const sx = W / minimap.w;
  const sy = H / minimap.h;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[55] px-panel p-1.5">
      <svg width={W} height={H} className="block" style={{ imageRendering: 'pixelated' }}>
        <rect x={0} y={0} width={W} height={H} rx={2} fill="#0b1120cc" />
        {minimap.dots.map((d, i) => {
          const r = d.kind === 'egg' ? 3.5 : d.kind === 'self' ? 3 : 2.5;
          return (
            <circle
              key={i}
              cx={Math.max(r, Math.min(W - r, d.x * sx))}
              cy={Math.max(r, Math.min(H - r, d.y * sy))}
              r={r}
              fill={d.color}
              stroke={d.kind === 'self' ? '#0b1120' : 'none'}
              strokeWidth={d.kind === 'self' ? 1.2 : 0}
            />
          );
        })}
      </svg>
    </div>
  );
}
