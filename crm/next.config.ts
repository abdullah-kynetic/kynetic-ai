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
  },
  async redirects() {
    const moved: [string, string][] = [
      ['/admin/agency', '/admin/prospecting'],
      ['/admin/agency/dialer', '/admin/prospecting/dialer'],
      ['/admin/agency/campaigns', '/admin/prospecting/campaigns'],
      ['/admin/agency/inbox', '/admin/sales/inbox'],
      ['/admin/agency/compose', '/admin/sales/compose'],
      ['/admin/agency/proposals', '/admin/sales/proposals'],
      ['/admin/agency/contracts', '/admin/sales/contracts'],
      ['/admin/agency/finance', '/admin/money/finance'],
      ['/admin/agency/billing', '/admin/money/billing'],
      ['/admin/agency/ops', '/admin/clients/operations'],
      ['/admin/users', '/admin/settings/team'],
      ['/admin/operations', '/admin/settings/integrations'],
      ['/admin/templates', '/admin/settings/build'],
      ['/admin/backups', '/admin/settings/system'],
      ['/dashboard/contacts', '/dashboard/leads/contacts'],
      ['/dashboard/pipeline', '/dashboard/leads/pipeline'],
      ['/dashboard/import', '/dashboard/leads/import'],
      ['/dashboard/tasks', '/dashboard/leads/tasks'],
      ['/dashboard/calls', '/dashboard/bookings/calls'],
      ['/dashboard/appointments', '/dashboard/bookings/appointments'],
      ['/dashboard/messages', '/dashboard/bookings/messages'],
      ['/dashboard/reviews', '/dashboard/reputation/reviews'],
      ['/dashboard/referrals', '/dashboard/reputation/referrals'],
      ['/dashboard/presence', '/dashboard/reputation/presence'],
      ['/dashboard/support', '/dashboard/help'],
      ['/dashboard/documents', '/dashboard/help/documents'],
      ['/dashboard/reports', '/dashboard/help/reports'],
      ['/dashboard/usage', '/dashboard/help/usage']
    ];
    return moved.map(([source, destination]) => ({ source, destination, statusCode: 301 }));
  }
};

export default nextConfig;
