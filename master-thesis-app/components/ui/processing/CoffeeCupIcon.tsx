import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./CoffeeCupIcon.module.css";

const CUP_BOTTOM_Y = 26;
const CUP_TOP_Y = 12;
const FILLABLE_RANGE = CUP_BOTTOM_Y - CUP_TOP_Y;

const VAPOR_DOTS = [
  { cx: 13, cy: 7, r: 1.5, delay: "0s" },
  { cx: 16, cy: 8, r: 2, delay: "0.8s" },
  { cx: 19, cy: 7, r: 1.5, delay: "1.6s" },
] as const;

export type CoffeeCupIconProps = {
  /** 0-100 */
  progress: number;
  size?: number;
  className?: string;
  /**
   * Når true: litt mer “aktiv” animasjon selv om progress=0.
   * Brukes typisk for indeterminate/lasting.
   */
  active?: boolean;
  /**
   * Når true: koppen er alltid fullt animert (damp, bølge, cupIdle) uavhengig av progress.
   * Brukes for prosesseringspanel slik at bruker alltid ser tydelig aktivitet.
   */
  alwaysAnimate?: boolean;
  /** Valgfri aria-label for skjermlesere (f.eks. "Laster"). */
  "aria-label"?: string;
};

export function CoffeeCupIcon({
  progress,
  size = 64,
  className,
  active = false,
  alwaysAnimate = false,
  "aria-label": ariaLabel,
}: CoffeeCupIconProps) {
  const id = React.useId();
  const gradId = `${id}-grad`;
  const clipId = `${id}-clip`;

  // Smooth transition av progress - unngår hopping
  const [smoothProgress, setSmoothProgress] = React.useState<number | null>(null);
  const targetProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0;
  const p = smoothProgress ?? targetProgress;

  React.useEffect(() => {
    if (Math.abs(targetProgress - (smoothProgress ?? targetProgress)) < 0.1) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      setSmoothProgress((prev) => {
        const current = prev ?? targetProgress;
        const diff = targetProgress - current;
        const step = diff * 0.08;
        return current + step;
      });
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [progress, smoothProgress, targetProgress]);

  const liquidY = CUP_BOTTOM_Y - (p / 100) * FILLABLE_RANGE;
  const isActive = alwaysAnimate || active || (p > 0 && p < 100);

  return (
    <div
      className={cn(
        styles.root,
        isActive && styles.rootActive,
        "relative",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "status" : undefined}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.82" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d="M8 12H24V20C24 23.3 21.3 26 18 26H14C10.7 26 8 23.3 8 20V12Z" />
          </clipPath>
        </defs>

        {isActive ? (
          <g opacity="0.55" aria-hidden="true">
            {VAPOR_DOTS.map((dot, i) => (
              <circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill="var(--muted-foreground)"
                fillOpacity="0.6"
                className={styles.vapor}
                style={{ animationDelay: dot.delay }}
              />
            ))}
          </g>
        ) : null}

        {/* Handle */}
        <path
          d="M24 16C26.5 16 28.5 17.5 28.5 19.5C28.5 21.5 26.5 23 24 23"
          stroke="var(--muted-foreground)"
          strokeOpacity="0.6"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Cup body */}
        <path
          d="M8 12H24V20C24 23.3 21.3 26 18 26H14C10.7 26 8 23.3 8 20V12Z"
          fill="var(--card)"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        <g clipPath={`url(#${clipId})`} className={styles.liquidGroup}>
          <rect
            x="0"
            y={liquidY}
            width="32"
            height="32"
            fill={`url(#${gradId})`}
            className={styles.liquidFill}
          />
          <g transform={`translate(16, ${liquidY})`}>
            <path
              d="M-32 0C-16 -2 0 0 16 -2C32 0 32 32 -32 32V0Z"
              fill="var(--primary)"
              fillOpacity="0.12"
              className={styles.wave}
            />
          </g>
        </g>

        {/* Rim */}
        <path
          d="M8 12H24"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
