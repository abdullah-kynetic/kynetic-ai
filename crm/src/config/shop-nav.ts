import type { NavGroup } from '@/types';
import type { ModuleKey } from '@/server/modules/keys';
import { clientAreas, shopAreas, SHOP_BASE } from './area-nav';

/**
 * Sidebar for clients with the `shop_ops` module: one entry per area, each area's pages as tabs
 * (same pattern as the rest of the portal). Settings and Help are the standard client areas.
 * Every entry declares the module, so the registry hides it for any tenant without it.
 * The server still gates each route.
 */
export { SHOP_BASE };

const standardArea = (title: string) => clientAreas.find((a) => a.title === title)!;

export const shopNavGroups: NavGroup[] = [
  {
    label: 'Shop',
    items: [...shopAreas, standardArea('Settings'), standardArea('Help')].map((area) => ({
      title: area.title,
      url: area.href,
      icon: area.icon,
      module: 'shop_ops' as const,
      items: []
    }))
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
