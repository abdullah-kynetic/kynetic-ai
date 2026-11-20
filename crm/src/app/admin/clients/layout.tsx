import { AreaLayout } from '@/components/layout/area-layout';
import { adminAreas } from '@/config/area-nav';

export default function ClientsAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={adminAreas[1]!}>{children}</AreaLayout>;
}
