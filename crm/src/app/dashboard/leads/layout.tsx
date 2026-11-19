import { AreaLayout } from '@/components/layout/area-layout';
import { clientAreas } from '@/config/area-nav';

export default function LeadsAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={clientAreas[1]!}>{children}</AreaLayout>;
}
