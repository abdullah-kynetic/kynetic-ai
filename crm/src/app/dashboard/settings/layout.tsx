import { AreaLayout } from '@/components/layout/area-layout';
import { clientAreas } from '@/config/area-nav';

export default function ClientSettingsAreaLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={clientAreas[4]!}>{children}</AreaLayout>;
}
