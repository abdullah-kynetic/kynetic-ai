import type { ReactNode } from 'react';
import { AgencyMotion } from '@/components/agency/motion';
import './agency.css';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <AgencyMotion>
      <div className='agency-workspace'>{children}</div>
    </AgencyMotion>
  );
}
