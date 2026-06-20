/**
 * Shared Open Graph / Twitter card image generator (1200×630, on-brand pixel
 * look). Imported by both `opengraph-image.tsx` and `twitter-image.tsx` so the
 * social preview is generated once and stays in sync.
 */
import { ImageResponse } from 'next/og';
import { siteConfig } from './siteConfig';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';
export const ogAlt = `${siteConfig.name} — real-time multiplayer chase game`;

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#11111C',
          // Chunky pixel grid (brand .pixel-grid), no blur/gradient.
          backgroundImage:
            'linear-gradient(rgba(255,201,60,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(255,201,60,0.06) 2px, transparent 2px)',
          backgroundSize: '48px 48px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
            color: '#FFC93C',
            textShadow: '8px 8px 0 #11111C',
          }}
        >
          CHASE
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: 2,
            lineHeight: 1.1,
            color: '#6AB04C',
            textShadow: '6px 6px 0 #11111C',
            marginTop: 8,
          }}
        >
          DINOSAURS
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 34,
            color: '#F4E7C3',
            opacity: 0.85,
          }}
        >
          Real-time multiplayer tag · 6 characters · 30-second rounds
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 26,
            color: '#5FCDE4',
          }}
        >
          {siteConfig.url.replace(/^https?:\/\//, '')}
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
