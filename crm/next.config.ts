import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  transpilePackages: ['geist'],
  // pdfkit reads its standard-font files from the package. read-excel-file unpacks
  // workbooks in its own worker. Keep both external so those files resolve.
  serverExternalPackages: ['pdfkit', 'read-excel-file'],
  // Lets module-off pages and the admin layout call forbidden() and answer 403 (PRD F-70, M8a-01).
  experimental: { authInterrupts: true },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
};

export default nextConfig;
