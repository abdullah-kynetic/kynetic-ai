'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AreaLayout } from '@/components/layout/area-layout';
import { shopAreas } from '@/config/area-nav';

/** Puts each shop page inside its area's tab bar. Today has no tabs, so it renders as is. */
export function ShopAreaFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const area = shopAreas.find((a) =>
    a.tabs.some((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
  );
  return area ? <AreaLayout area={area}>{children}</AreaLayout> : <>{children}</>;
}
