import { defineConfig } from 'astro/config';

// Static output so it can be deployed to Cloudflare Pages as plain files.
// /audit is an internal sales-call tool: it is only built when INCLUDE_AUDIT=1 (local use),
// so it never ships in the public build.
const auditRoute = {
  name: 'internal-audit-route',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (process.env.INCLUDE_AUDIT === '1') {
        injectRoute({ pattern: '/audit', entrypoint: './src/internal/audit.astro' });
      }
    },
  },
};

export default defineConfig({
  site: 'https://kyneticai.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  integrations: [auditRoute],
});
