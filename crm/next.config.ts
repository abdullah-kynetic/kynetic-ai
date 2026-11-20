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
      ['/admin/agency/proposals/:proposalId', '/admin/sales/proposals/:proposalId'],
      ['/admin/agency/proposals/:proposalId/preview', '/admin/sales/proposals/:proposalId/preview'],
      ['/admin/agency/contracts', '/admin/sales/contracts'],
      ['/admin/agency/finance', '/admin/money/finance'],
      ['/admin/agency/billing', '/admin/money/billing'],
      ['/admin/agency/ops', '/admin/clients/operations'],
      ['/admin/support', '/admin/clients/operations/support'],
      ['/admin/support/:id', '/admin/clients/operations/support/:id'],
      ['/admin/system-requests', '/admin/clients/operations/system-requests'],
      ['/admin/usage', '/admin/money/usage'],
      ['/admin/archive', '/admin/settings/system/archive'],
      ['/admin/archive/:path*', '/admin/settings/system/archive/:path*'],
      ['/admin/audit', '/admin/settings/system/audit'],
      ['/admin/users', '/admin/settings/team'],
      ['/admin/operations', '/admin/settings/integrations'],
      ['/admin/templates', '/admin/settings/build'],
      ['/admin/backups', '/admin/settings/system'],
      ['/dashboard/contacts', '/dashboard/leads/contacts'],
      ['/dashboard/contacts/:id', '/dashboard/leads/contacts/:id'],
      ['/dashboard/pipeline', '/dashboard/leads/pipeline'],
      ['/dashboard/deals/:id', '/dashboard/leads/pipeline/:id'],
      ['/dashboard/import', '/dashboard/leads/import'],
      ['/dashboard/tasks', '/dashboard/leads/tasks'],
      ['/dashboard/companies', '/dashboard/leads/companies'],
      ['/dashboard/companies/new', '/dashboard/leads/companies/new'],
      ['/dashboard/companies/:id', '/dashboard/leads/companies/:id'],
      ['/dashboard/calls', '/dashboard/bookings/calls'],
      ['/dashboard/calls/:id', '/dashboard/bookings/calls/:id'],
      ['/dashboard/appointments', '/dashboard/bookings/appointments'],
      ['/dashboard/messages', '/dashboard/bookings/messages'],
      ['/dashboard/reviews', '/dashboard/reputation/reviews'],
      ['/dashboard/referrals', '/dashboard/reputation/referrals'],
      ['/dashboard/presence', '/dashboard/reputation/presence'],
      ['/dashboard/support', '/dashboard/help'],
      ['/dashboard/support/:id', '/dashboard/help/:id'],
      ['/dashboard/documents', '/dashboard/help/documents'],
      ['/dashboard/reports', '/dashboard/help/reports'],
      ['/dashboard/reports/:id', '/dashboard/help/reports/:id'],
      ['/dashboard/usage', '/dashboard/help/usage'],
      ['/dashboard/systems', '/dashboard/settings/systems'],
      ['/dashboard/notifications', '/dashboard/help/notifications']
    ];
    return moved.map(([source, destination]) => ({
      source,
      destination,
      statusCode: 301
    }));
  }
};

export default nextConfig;
