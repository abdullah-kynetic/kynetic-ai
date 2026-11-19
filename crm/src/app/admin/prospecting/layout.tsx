import { AreaLayout } from '@/components/layout/area-layout';
import { adminAreas } from '@/config/area-nav';
import '../agency/agency.css';

export default function ProspectingAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={adminAreas[2]!}>{children}</AreaLayout>;
}
