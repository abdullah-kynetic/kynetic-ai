import type { ReactNode } from 'react';
import { Heading } from '@/components/ui/heading';
import { IconLock } from '@tabler/icons-react';

export default function AgencyPage({
  children,
  pageTitle,
  pageDescription
}: {
  children: ReactNode;
  pageTitle: string;
  pageDescription?: string;
}) {
  return (
    <div className='agency-page'>
      <header className='agency-page-heading'>
        <Heading title={pageTitle} description={pageDescription ?? ''} />
        <span className='agency-environment'>
          <IconLock size={14} aria-hidden='true' /> Synthetic workspace
        </span>
      </header>
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
