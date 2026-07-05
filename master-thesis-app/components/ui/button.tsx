"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const Slot = SlotPrimitive.Root;

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Vis spinner og sett `aria-busy` (ikke bruk sammen med `asChild`). */
    loading?: boolean;
    /** Skjermleser-tekst mens `loading` er sann. */
    loadingLabel?: string;
  };

function Button({
  ref,
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel = "Laster …",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        aria-expanded={
          (props as { "aria-expanded"?: boolean | "true" | "false" })[
            "aria-expanded"
          ] ?? false
        }
        aria-haspopup={
          (
            props as {
              "aria-haspopup"?:
                | boolean
                | "true"
                | "false"
                | "dialog"
                | "menu"
                | "grid"
                | "listbox"
                | "tree";
            }
          )["aria-haspopup"] ?? undefined
        }
        disabled={disabled}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-expanded={
        (props as { "aria-expanded"?: boolean | "true" | "false" })[
          "aria-expanded"
        ] ?? false
      }
      aria-haspopup={
        (
          props as {
            "aria-haspopup"?:
              | boolean
              | "true"
              | "false"
              | "dialog"
              | "menu"
              | "grid"
              | "listbox"
              | "tree";
          }
        )["aria-haspopup"] ?? undefined
      }
      {...props}
    >
      {loading ? (
        <>
          <Spinner
            variant="circle"
            size={size === "sm" ? 14 : size === "lg" ? 18 : 16}
            className="shrink-0 opacity-90"
            label={loadingLabel}
          />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button };
