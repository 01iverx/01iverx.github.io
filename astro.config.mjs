import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://01iverx.github.io',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: true,
    },
  },
});
