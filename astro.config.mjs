// Astro config. Most pages (home, admin) are built to plain HTML at build time.
// Product pages are rendered on demand (prerender = false in their template), so
// the Cloudflare adapter runs them on Cloudflare Workers, free tier.
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // The public address, used for share previews and canonical links. Set SITE_URL
  // on the host (e.g. https://panigacraftz.<account>.workers.dev) until the domain is chosen.
  site: process.env.SITE_URL || 'https://panigacraftz.com.au',
  trailingSlash: 'ignore',
  adapter: cloudflare({ imageService: 'passthrough' }), // no paid image resizing
  session: false, // the site keeps no server sessions (the enquiry list lives in the visitor's browser)
  vite: { plugins: [tailwindcss()] }
});
