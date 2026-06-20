import type { MetadataRoute } from 'next';
import { siteConfig } from './siteConfig';

/** Static, crawlable routes. The in-game flow (mode/character/map selection,
 *  lobby, game, results) is interactive client state, not indexable content. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteConfig.url}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteConfig.url}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteConfig.url}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
