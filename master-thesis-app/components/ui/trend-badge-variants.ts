import { cva } from "class-variance-authority";

export const trendBadgeVariants = cva(
  "inline-flex items-center gap-1 font-medium tabular-nums transition-all",
  {
    variants: {
      variant: {
        "soft-positive": [
          "bg-success/10 text-success border border-success/20",
          "dark:bg-success/15 dark:text-success dark:border-success/30",
        ].join(" "),
        "soft-negative": [
          "bg-destructive/10 text-destructive border border-destructive/20",
          "dark:bg-destructive/15 dark:text-destructive dark:border-destructive/30",
        ].join(" "),
        "soft-neutral": [
          "bg-muted text-muted-foreground border border-border",
          "dark:bg-muted/50 dark:text-muted-foreground dark:border-border/50",
        ].join(" "),
        "solid-positive": [
          "bg-success text-success-foreground",
          "dark:bg-success/90 dark:text-success-foreground",
        ].join(" "),
        "solid-negative": [
          "bg-destructive text-destructive-foreground",
          "dark:bg-destructive/90 dark:text-destructive-foreground",
        ].join(" "),
        "solid-neutral": [
          "bg-muted text-muted-foreground",
          "dark:bg-muted/70 dark:text-muted-foreground",
        ].join(" "),
        "ghost-positive": "text-success",
        "ghost-negative": "text-destructive",
        "ghost-neutral": "text-muted-foreground",
        "outline-positive":
          "border border-success/40 text-success bg-transparent",
        "outline-negative":
          "border border-destructive/40 text-destructive bg-transparent",
        "outline-neutral":
          "border border-border text-muted-foreground bg-transparent",
      },
      size: {
        xs: "text-[10px] px-1.5 py-0.5 rounded",
        sm: "text-xs px-2 py-0.5 rounded-md",
        md: "text-sm px-2.5 py-1 rounded-md",
        lg: "text-base px-3 py-1.5 rounded-lg",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "soft-positive",
      size: "sm",
      shape: "rounded",
    },
  },
);
