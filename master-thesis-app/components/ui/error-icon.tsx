"use client";

import { m } from "@/lib/motion/m";
import { cn } from "@/lib/utils";

export interface ErrorIconProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const sizeClasses = {
  xs: "size-14",
  sm: "size-20",
  md: "size-28",
  lg: "size-32",
} as const;

const svgSizes = {
  xs: 44,
  sm: 56,
  md: 72,
  lg: 80,
} as const;

export function ErrorIcon({ className, size = "md" }: ErrorIconProps) {
  const svgSize = svgSizes[size];
  const center = svgSize / 2;
  const strokeW = size === "xs" ? 2 : 2.5;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex justify-center", className)}
    >
      <div
        className={cn(
          "rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center",
          sizeClasses[size],
        )}
      >
        <m.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground"
          aria-hidden
        >
          <m.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            d={`M ${center} ${center - center * 0.85}
                Q ${center + center * 0.85} ${center - center * 0.6}, ${
                  center + center * 0.85
                } ${center}
                Q ${center + center * 0.85} ${
                  center + center * 0.6
                }, ${center} ${center + center * 0.85}
                Q ${center - center * 0.85} ${center + center * 0.6}, ${
                  center - center * 0.85
                } ${center}
                Q ${center - center * 0.85} ${
                  center - center * 0.6
                }, ${center} ${center - center * 0.85} Z`}
            stroke="currentColor"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="opacity-80"
          />
          <m.circle
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.4, ease: "easeOut" }}
            cx={center - svgSize * 0.15}
            cy={center - svgSize * 0.08}
            r={svgSize * 0.04}
            fill="currentColor"
            className="opacity-90"
          />
          <m.circle
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.45, ease: "easeOut" }}
            cx={center + svgSize * 0.15}
            cy={center - svgSize * 0.08}
            r={svgSize * 0.04}
            fill="currentColor"
            className="opacity-90"
          />
          <m.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
            d={`M ${center - svgSize * 0.14} ${center + svgSize * 0.12} 
                Q ${center} ${center + svgSize * 0.22}, ${
                  center + svgSize * 0.14
                } ${center + svgSize * 0.12}`}
            stroke="currentColor"
            strokeWidth={strokeW}
            strokeLinecap="round"
            fill="none"
            className="opacity-90"
          />
          <m.path
            initial={{ opacity: 0, scale: 0.5, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: "easeOut" }}
            d={`M ${center + svgSize * 0.13} ${center - svgSize * 0.02} 
                Q ${center + svgSize * 0.12} ${center + svgSize * 0.04}, 
                  ${center + svgSize * 0.11} ${center + svgSize * 0.1}
                Q ${center + svgSize * 0.1} ${center + svgSize * 0.16}, 
                  ${center + svgSize * 0.11} ${center + svgSize * 0.2}
                Q ${center + svgSize * 0.12} ${center + svgSize * 0.22}, 
                  ${center + svgSize * 0.13} ${center + svgSize * 0.21}
                Q ${center + svgSize * 0.14} ${center + svgSize * 0.2}, 
                  ${center + svgSize * 0.14} ${center + svgSize * 0.18}
                Q ${center + svgSize * 0.14} ${center + svgSize * 0.14}, 
                  ${center + svgSize * 0.135} ${center + svgSize * 0.1}
                Q ${center + svgSize * 0.13} ${center + svgSize * 0.06}, 
                  ${center + svgSize * 0.13} ${center - svgSize * 0.02} Z`}
            fill="currentColor"
            className="opacity-80"
          />
        </m.svg>
      </div>
    </m.div>
  );
}
