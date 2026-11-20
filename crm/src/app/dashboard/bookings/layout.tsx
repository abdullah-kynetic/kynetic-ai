import { AreaLayout } from '@/components/layout/area-layout';
import { clientAreas } from '@/config/area-nav';

export default function BookingsAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={clientAreas[2]!}>{children}</AreaLayout>;
}
