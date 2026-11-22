// Astro config. Static output: every page is built to plain HTML at build time,
// which Cloudflare Pages or Netlify can host for free.
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://panigacraftz.com.au', // placeholder until the domain is chosen
  trailingSlash: 'ignore',
  vite: { plugins: [tailwindcss()] }
});
