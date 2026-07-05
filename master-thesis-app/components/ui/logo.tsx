"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { useEffect, useState } from "react";

type LogoProps = {
  className?: string;
  variant?: "full" | "icon";
  width?: number;
  height?: number;
  /**
   * Whether to prioritize loading this image.
   * Defaults to `true` for "full" variant (typically above-the-fold) and `false` for "icon" variant.
   * Set to `false` explicitly if the logo appears below the fold or in less critical areas.
   */
  priority?: boolean;
  alt?: string;
};

const DEFAULT_DIMENSIONS: Record<
  Required<LogoProps>["variant"],
  {
    width: number;
    height: number;
  }
> = {
  full: { width: 200, height: 54 },
  icon: { width: 48, height: 48 },
};

export default function Logo({
  className,
  variant = "full",
  width,
  height,
  priority,
  alt,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const defaultDimensions = DEFAULT_DIMENSIONS[variant];
  const imageWidth = width ?? defaultDimensions.width;
  const imageHeight = height ?? defaultDimensions.height;
  // Full logos are typically above-the-fold and should be prioritized by default
  const shouldPrioritize = priority ?? variant === "full";

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Ikke vis logo før vi vet hvilket tema som gjelder på klienten
  if (!mounted) {
    return (
      <div
        className={cn(
          "bg-muted rounded animate-pulse",
          !width && !height
            ? variant === "full"
              ? "h-[32px] w-[120px]"
              : "h-[32px] w-[32px]"
            : undefined,
          className,
        )}
        style={
          width || height
            ? { width: imageWidth, height: imageHeight }
            : undefined
        }
      />
    );
  }

  // Velg riktig logo basert på tema og variant
  const src =
    variant === "full"
      ? resolvedTheme === "dark"
        ? "/scoped-logo-hvit.png"
        : "/scoped-logo.png"
      : variant === "icon"
        ? "/icon.png"
        : "/scoped-logo.png";

  // Ikon: `fill` i boks med eksplisitte px — unngår Next/Image-advarsel når foreldre legger på
  // `h-*` / `w-*` / `object-cover` som ellers kan endre bare én dimensjon mot width/height-props.
  if (variant === "icon") {
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden rounded-full",
          className,
        )}
        style={{ width: imageWidth, height: imageHeight }}
      >
        <Image
          src={src}
          alt={alt ?? "Scoped Solutions"}
          fill
          sizes={`${Math.max(32, Math.ceil(imageWidth))}px`}
          className="object-cover"
          priority={shouldPrioritize}
        />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt ?? "Scoped Solutions"}
      width={imageWidth}
      height={imageHeight}
      className={cn("block max-w-full shrink-0 object-contain", className)}
      priority={shouldPrioritize}
    />
  );
}
