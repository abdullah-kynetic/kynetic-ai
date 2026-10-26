'use client';

import * as React from 'react';
import { IconAlertTriangle, IconLock } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';

/** Icon, display-font title, one sentence, and one primary action (DESIGN_SYSTEM "Empty / loading / error primitives"). */
function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty data-slot='empty-state' className={className}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant='icon'>{icon}</EmptyMedia> : null}
        <EmptyTitle role='heading' aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** A message, a "Try again" action, and a reference id support can search for. */
function ErrorState({
  title = 'Something went wrong',
  message,
  reference,
  onRetry,
  retryLabel = 'Try again',
  className
}: {
  title?: string;
  message: string;
  reference?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <Empty data-slot='error-state' role='alert' className={cn('border-destructive', className)}>
      <EmptyHeader>
        <EmptyMedia variant='icon' className='text-destructive'>
          <IconAlertTriangle aria-hidden='true' />
        </EmptyMedia>
        <EmptyTitle role='heading' aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button onClick={onRetry}>{retryLabel}</Button>
        </EmptyContent>
      ) : null}
      {reference ? (
        <p className='text-xs text-muted-foreground'>
          Reference: <span className='font-mono'>{reference}</span>
        </p>
      ) : null}
    </Empty>
  );
}

/** For role limits. Rarely needed because the UI hides what a role cannot do. */
function NoAccess({
  title = 'You do not have access to this page',
  description = 'Ask the account owner to change your role if you need it.',
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Empty data-slot='no-access' className={className}>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <IconLock aria-hidden='true' />
        </EmptyMedia>
        <EmptyTitle role='heading' aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export { EmptyState, ErrorState, NoAccess };
