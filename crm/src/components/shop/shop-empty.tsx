import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/states';

/** Empty state for a shop screen: says what will appear here and, optionally, what to do about it. */
export function ShopEmpty({
  title,
  description,
  action,
  icon
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return <EmptyState title={title} description={description} action={action} icon={icon} />;
}
