import { AreaLayout } from '@/components/layout/area-layout';
import { clientAreas } from '@/config/area-nav';

export default function ReputationAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={clientAreas[3]!}>{children}</AreaLayout>;
}
