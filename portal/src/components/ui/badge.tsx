import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-foreground/10 bg-foreground/[0.04] text-muted",
        brand: "border-brand/40 bg-brand-tint text-brand-text",
        success: "border-success/30 bg-success/10 text-success-text",
        warning: "border-warning/30 bg-warning/10 text-warning-text",
        danger: "border-danger/30 bg-danger/10 text-danger-text",
        info: "border-info/30 bg-info/10 text-info-text",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, dot, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
