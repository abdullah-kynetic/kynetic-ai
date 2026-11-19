import { AreaLayout } from '@/components/layout/area-layout';
import { clientAreas } from '@/config/area-nav';

export default function HelpAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={clientAreas[5]!}>{children}</AreaLayout>;
}
