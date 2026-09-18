import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://stardustds.xyz',
  // Hybrid: every page static by default; /structure opts out
  // (`export const prerender = false`) so it re-fetches the roster sheet
  // on every request instead of only at build time — same pattern as
  // Urban Wolf Studio's /funds page.
  output: 'hybrid',
  adapter: vercel(),
});
