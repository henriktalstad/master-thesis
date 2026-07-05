"use client";

import { useTheme } from "@/providers/theme-provider";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useEffect, useState } from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  // Bind alltid til et konkret tema (light/dark) for å unngå system/døgn‑skifte
  const effectiveTheme = (
    (mounted ? resolvedTheme : "light") === "dark" ? "dark" : "light"
  ) as ToasterProps["theme"];

  return (
    <Sonner
      theme={effectiveTheme}
      className="toaster group"
      visibleToasts={4}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
