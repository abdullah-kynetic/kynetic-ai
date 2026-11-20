'use client';

import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useFormStatus } from 'react-dom';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

const transition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

/** Motion is reserved for selection continuity and pending feedback; content never starts hidden. */
export function AgencyMotion({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion='user' transition={transition}>
      {children}
    </MotionConfig>
  );
}
function pendingText(children: ReactNode) {
  if (typeof children !== 'string') return 'Working…';
  if (children.startsWith('Save')) return 'Saving…';
  if (children.startsWith('Create')) return 'Creating…';
  if (children.startsWith('Simulate')) return 'Simulating…';
  if (children.startsWith('Check')) return 'Checking…';
  if (children.startsWith('Rotate')) return 'Rotating…';
  return 'Working…';
}
export function AgencySubmitButton({
  children,
  disabled,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const reduced = useReducedMotion();
  return (
    <Button
      {...props}
      type={props.type ?? 'submit'}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      <motion.span
        initial={false}
        animate={{ opacity: pending ? 0.7 : 1 }}
        transition={{ duration: reduced ? 0 : 0.12, ease: transition.ease }}
      >
        <span
          className='agency-submit-label'
          style={{ visibility: pending ? 'hidden' : 'visible' }}
          aria-hidden={pending || undefined}
        >
          {children}
        </span>
        {pending && (
          <span className='agency-submit-pending'>{pendingLabel ?? pendingText(children)}</span>
        )}
      </motion.span>
    </Button>
  );
}
