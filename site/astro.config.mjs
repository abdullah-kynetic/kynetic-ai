import { defineConfig } from 'astro/config';

// Static output so it can be deployed to Cloudflare Pages as plain files.
export default defineConfig({
  site: 'https://kyneticai.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
});
