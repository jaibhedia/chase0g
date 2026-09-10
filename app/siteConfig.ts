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
  /**
   * Title and description lead with the egg and the pot, in that order.
   *
   * The previous copy described a browser tag game and never mentioned USDC, Arc or
   * staking — so the first thing a crawler, a link preview or a judge read said nothing
   * about the part that makes this different from any other .io game. It also never said
   * what winning means, which is the same reason people watching the gameplay assumed it
   * was a racing game.
   *
   * Kept near 60 / 155 characters so neither is truncated in search results.
   */
  title: 'Chase Dinosaurs — Multiplayer Chase Game with USDC Stakes',
  description:
    'Grab the egg and survive the chase. Real-time 16-bit multiplayer where ranked ' +
    'matches escrow USDC on Arc — winner takes the pot. Free to play in your browser.',
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
    // The on-chain half. Without these the site is invisible to anyone searching for
    // what actually distinguishes it.
    'usdc game',
    'crypto game',
    'web3 game',
    'play to earn',
    'arc network',
    'onchain gaming',
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
