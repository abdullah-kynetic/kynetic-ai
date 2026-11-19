import { AreaLayout } from '@/components/layout/area-layout';
import { adminAreas } from '@/config/area-nav';
import '../agency/agency.css';

export default function SalesAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={adminAreas[3]!}>{children}</AreaLayout>;
}
