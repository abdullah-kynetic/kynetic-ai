import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),white_8%)] active:inset-ring-1 active:inset-ring-foreground/20',
        outline: 'border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted',
        secondary: 'border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted',
        ghost: 'text-primary-text hover:underline hover:underline-offset-4 aria-expanded:bg-muted',
        destructive: 'border-destructive bg-card text-destructive hover:bg-muted',
        'destructive-solid':
          'bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive),black_10%)]',
        link: 'text-primary-text underline-offset-4 hover:underline'
      },
      size: {
        default:
          'h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "min-h-11 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-11 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-11 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        icon: 'size-11',
        'icon-xs':
          "min-h-11 min-w-11 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'min-h-11 min-w-11 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-11'
      }
    },
    // Icon-only ghost buttons stay neutral; the orange underlined style is for text actions.
    compoundVariants: (['icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const).map((size) => ({
      variant: 'ghost' as const,
      size,
      className: 'text-foreground hover:bg-muted hover:no-underline'
    })),
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
