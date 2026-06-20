import type { MetadataRoute } from 'next';
import { siteConfig } from './siteConfig';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Transient, state-dependent screens — nothing to index there.
      disallow: ['/game', '/results'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
