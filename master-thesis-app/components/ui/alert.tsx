import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export { AlertTitle } from "@/components/ui/alert-title";
export { AlertDescription } from "@/components/ui/alert-description";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default:
          "bg-card text-card-foreground [&_[data-slot=alert-description]]:text-muted-foreground",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/30 [&>svg]:text-current [&_[data-slot=alert-description]]:text-destructive/90",
        success:
          "bg-success/10 text-success border-success/30 [&>svg]:text-current [&_[data-slot=alert-description]]:text-success/90",
        warning:
          "border-warning/30 bg-warning/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50 [&>svg]:text-amber-800 dark:[&>svg]:text-amber-300 [&_[data-slot=alert-description]]:text-amber-900/95 dark:[&_[data-slot=alert-description]]:text-amber-100/95",
        info: "bg-info/10 text-info border-info/30 [&>svg]:text-current [&_[data-slot=alert-description]]:text-info/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
