import type { ReactNode } from 'react';
import { AgencyMotion, AgencyNavigation } from '@/components/agency/motion';
import './agency.css';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <AgencyMotion>
      <div className='agency-workspace'>
        <AgencyNavigation />
        {children}
      </div>
    </AgencyMotion>
  );
}
