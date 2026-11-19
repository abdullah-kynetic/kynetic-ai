import { AreaLayout } from '@/components/layout/area-layout';
import { adminAreas } from '@/config/area-nav';

export default function AdminSettingsAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={adminAreas[5]!}>{children}</AreaLayout>;
}
