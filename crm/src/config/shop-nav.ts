import type { NavGroup } from '@/types';
import type { ModuleKey } from '@/server/modules/keys';

/**
 * Sidebar for clients with the `shop_ops` module (AA shop track, README "five groups").
 * Settings and Help sit inside the last group. Every entry declares the module, so the
 * registry hides it for any tenant without it. The server still gates each route.
 */
export const SHOP_BASE = '/dashboard/shop';

export const shopNavGroups: NavGroup[] = [
  {
    label: 'Front desk',
    items: [
      { title: 'Today', url: `${SHOP_BASE}/today`, icon: 'dashboard', module: 'shop_ops' },
      { title: 'Leads', url: `${SHOP_BASE}/leads`, icon: 'teams', module: 'shop_ops' },
      { title: 'Calls and texts', url: `${SHOP_BASE}/calls`, icon: 'phone', module: 'shop_ops' },
      { title: 'Calendar', url: `${SHOP_BASE}/calendar`, icon: 'calendar', module: 'shop_ops' }
    ]
  },
  {
    label: 'Shop floor',
    items: [
      { title: 'Jobs board', url: `${SHOP_BASE}/jobs`, icon: 'kanban', module: 'shop_ops' },
      { title: 'Quotes', url: `${SHOP_BASE}/quotes`, icon: 'forms', module: 'shop_ops' },
      {
        title: 'Insurance',
        url: `${SHOP_BASE}/insurance`,
        icon: 'badgeCheck',
        module: 'shop_ops'
      },
      { title: 'Team', url: `${SHOP_BASE}/team`, icon: 'account', module: 'shop_ops' }
    ]
  },
  {
    label: 'Money',
    items: [
      {
        title: 'Weekly report',
        url: `${SHOP_BASE}/report`,
        icon: 'trendingUp',
        module: 'shop_ops'
      },
      { title: 'Money in and out', url: `${SHOP_BASE}/money`, icon: 'billing', module: 'shop_ops' },
      { title: 'Documents', url: '/dashboard/help/documents', icon: 'page', module: 'shop_ops' }
    ]
  },
  {
    label: 'Customers and reputation',
    items: [
      { title: 'Customers', url: `${SHOP_BASE}/customers`, icon: 'user', module: 'shop_ops' },
      { title: 'Reviews', url: `${SHOP_BASE}/reviews`, icon: 'exclusive', module: 'shop_ops' },
      { title: 'Get found', url: `${SHOP_BASE}/found`, icon: 'search', module: 'shop_ops' },
      {
        title: 'Referrals',
        url: '/dashboard/reputation/referrals',
        icon: 'share',
        module: 'shop_ops'
      }
    ]
  },
  {
    label: 'Control',
    items: [
      { title: 'Away mode', url: `${SHOP_BASE}/away`, icon: 'moon', module: 'shop_ops' },
      {
        title: 'Connections',
        url: `${SHOP_BASE}/connections`,
        icon: 'adjustments',
        module: 'shop_ops'
      },
      { title: 'Settings', url: '/dashboard/settings', icon: 'settings', module: 'shop_ops' },
      { title: 'Help', url: '/dashboard/help', icon: 'help', module: 'shop_ops' }
    ]
  }
];

/** The client sidebar for a tenant: the shop groups when `shop_ops` is on, today's groups otherwise. */
export function clientNavFor(
  enabled: { keys: readonly ModuleKey[] },
  standard: NavGroup[],
  shop: NavGroup[] = shopNavGroups
): NavGroup[] {
  return enabled.keys.includes('shop_ops') ? shop : standard;
}
