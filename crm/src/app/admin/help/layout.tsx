import { AreaLayout } from '@/components/layout/area-layout';
import { vaHelpArea } from '@/config/area-nav';

export default function AdminHelpLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area={vaHelpArea}>{children}</AreaLayout>;
}
