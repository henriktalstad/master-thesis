import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary/60",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        success:
          "border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90 focus-visible:ring-success/20",
        warning:
          "border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90 focus-visible:ring-warning/20",
        info: "border-transparent bg-info text-info-foreground [a&]:hover:bg-info/90 focus-visible:ring-info/20",
        outline:
          "text-foreground border-border [a&]:hover:bg-muted/50 [a&]:hover:text-foreground",
        soft: "border-transparent bg-accent/20 text-foreground [a&]:hover:bg-accent/30",
        ghost:
          "border-transparent bg-transparent text-foreground [a&]:hover:bg-muted/40",
        "soft-destructive":
          "border-destructive/20 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/20",
        "soft-success":
          "border-success/20 bg-success/10 text-success [a&]:hover:bg-success/20",
        "soft-warning":
          "border-warning/20 bg-warning/10 text-warning [a&]:hover:bg-warning/20",
        "soft-info":
          "border-info/20 bg-info/10 text-info [a&]:hover:bg-info/20",
      },
      size: {
        sm: "px-1 py-0.5 text-[10px]",
        md: "px-1.5 py-0.5 text-[11px]",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      shape: "rounded",
    },
  },
);
