import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { IconLock } from '@tabler/icons-react';

export default function AgencyPage({
  children,
  pageTitle,
  pageDescription,
  actions
}: {
  children: ReactNode;
  pageTitle: string;
  pageDescription?: string;
  actions?: ReactNode;
}) {
  return (
    <div className='agency-page'>
      <div className='agency-page-heading'>
        <PageHeader
          title={pageTitle}
          description={pageDescription}
          actions={
            <>
              {actions}
              <span className='agency-environment'>
                <IconLock size={14} aria-hidden='true' /> Synthetic workspace
              </span>
            </>
          }
        />
      </div>
      {children}
    </div>
  );
}
export function AgencyEmptyState({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className='agency-empty'>
      <p className='agency-empty-title'>{title}</p>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function AgencyStatus({ value }: { value: string }) {
  return (
    <span className='agency-status' data-state={value}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}
