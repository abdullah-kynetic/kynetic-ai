import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircle,
  IconCircleCheck,
  IconInfoCircle
} from '@tabler/icons-react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>svg]:pointer-events-none [&>svg]:size-3.5!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        // Status chips: tone text on a 12% tint of the tone over the surface (DESIGN_SYSTEM "Chips and badges").
        success: 'bg-[color-mix(in_oklch,var(--success)_12%,var(--card))] text-success',
        info: 'bg-[color-mix(in_oklch,var(--info)_12%,var(--card))] text-info',
        neutral: 'bg-muted text-muted-foreground',
        warning: 'bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))] text-warning',
        error: 'bg-[color-mix(in_oklch,var(--destructive)_12%,var(--card))] text-destructive',
        // Tags (F-05): neutral outlined, no per-tag color.
        outline: 'border-input text-foreground',
        link: 'text-primary-text underline-offset-4 hover:underline'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className)
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant
    }
  });
}

type StatusTone = 'success' | 'info' | 'neutral' | 'warning' | 'error';

const statusIcons = {
  success: IconCircleCheck,
  info: IconInfoCircle,
  neutral: IconCircle,
  warning: IconAlertTriangle,
  error: IconAlertOctagon
} satisfies Record<StatusTone, typeof IconCircle>;

/** A status chip is always icon plus text, never color alone (DESIGN_SYSTEM accessibility). */
function StatusBadge({
  tone,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'span'>, 'color'> & { tone: StatusTone }) {
  const Icon = statusIcons[tone];
  return (
    <Badge variant={tone} className={className} {...props}>
      <Icon aria-hidden='true' />
      {children}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants };
export type { StatusTone };
