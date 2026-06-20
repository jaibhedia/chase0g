/**
 * Single source of truth for site-wide SEO / metadata.
 *
 * The production domain drives canonical URLs, Open Graph tags, the sitemap and
 * robots.txt — set it correctly. Override per environment with
 * `NEXT_PUBLIC_SITE_URL` (e.g. in the Vercel project env) so previews and prod
 * each point at the right host.
 */
const DEFAULT_URL = 'https://chase.abstractstudio.in';

export const siteConfig = {
  name: 'Chase Dinosaurs',
  title: 'Chase Dinosaurs — Real-Time Multiplayer Chase Game',
  description:
    'A fast-paced 16-bit multiplayer chase game. Top-down tag — one player is the chaser, ' +
    'everyone else runs. 30-second rounds, 6 characters, unique power-ups. Play free in your browser.',
  /** Canonical production origin (no trailing slash). */
  url: (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_URL).replace(/\/+$/, ''),
  keywords: [
    'chase dinosaurs',
    'multiplayer game',
    'browser game',
    'online tag game',
    'pixel art game',
    'io game',
    'real-time multiplayer',
    'free online game',
    'phaser game',
    'chase game',
  ],
  authors: [{ name: 'Shantanu Swami', url: 'https://x.com/ShantanuSwami11' }],
  creator: 'Shantanu Swami',
  /** Used for twitter:creator / twitter:site. */
  twitterHandle: '@ShantanuSwami11',
  locale: 'en_US',
  socials: {
    x: 'https://x.com/ShantanuSwami11',
    telegram: 'https://t.me/shantanucsd',
  },
} as const;
