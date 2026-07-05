"use client";

import {
  LoaderCircleIcon,
  LoaderIcon,
  LoaderPinwheelIcon,
  type LucideProps,
} from "lucide-react";
import { LAST } from "@/lib/plattform-loading-labels";
import { cn } from "@/lib/utils";

export type SpinnerProps = Omit<LucideProps, "ref"> & {
  variant?:
    | "default"
    | "circle"
    | "pinwheel"
    | "circle-filled"
    | "ellipsis"
    | "ring"
    | "bars"
    | "infinite"
    /** Tre små prikker – diskret for delvise oppdateringer */
    | "dots";
  label?: string;
  /**
   * Kun visuell – ingen role=status/sr-only (bruk når forelder har én felles aria-label,
   * f.eks. RouteSegmentLoading).
   */
  decorative?: boolean;
};

type SpinnerVariantProps = Omit<SpinnerProps, "variant" | "label">;

/** Ikke bruk `transform-gpu` på Lucide-SVG: statisk `transform` kan overskrive/stanse `animate-spin`. */
const spinIcon = (className?: string) =>
  cn("animate-spin motion-reduce:animate-none", className);

const Default = ({ className, ...props }: SpinnerVariantProps) => (
  <LoaderIcon className={spinIcon(className)} {...props} />
);

const Circle = ({ className, ...props }: SpinnerVariantProps) => (
  <LoaderCircleIcon className={spinIcon(className)} {...props} />
);

const Pinwheel = ({ className, ...props }: SpinnerVariantProps) => (
  <LoaderPinwheelIcon className={spinIcon(className)} {...props} />
);

const CircleFilled = ({
  className,
  size = 24,
  ...props
}: SpinnerVariantProps) => (
  <div
    className={cn("relative text-primary", className)}
    style={{ width: size, height: size }}
  >
    <div className="absolute inset-0 rotate-180 opacity-20">
      <LoaderCircleIcon
        className="animate-[spin_1.4s_linear_infinite] motion-reduce:animate-none"
        size={size}
        {...props}
      />
    </div>
    <LoaderCircleIcon
      className="relative animate-[spin_0.9s_linear_infinite] motion-reduce:animate-none"
      size={size}
      {...props}
    />
  </div>
);

const Ellipsis = ({ size = 24, ...props }: SpinnerVariantProps) => {
  return (
    <svg
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Loading...</title>
      <circle cx="4" cy="12" fill="currentColor" r="2">
        <animate
          attributeName="cy"
          begin="0;ellipsis3.end+0.25s"
          calcMode="spline"
          dur="0.6s"
          id="ellipsis1"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          values="12;6;12"
        />
      </circle>
      <circle cx="12" cy="12" fill="currentColor" r="2">
        <animate
          attributeName="cy"
          begin="ellipsis1.begin+0.1s"
          calcMode="spline"
          dur="0.6s"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          values="12;6;12"
        />
      </circle>
      <circle cx="20" cy="12" fill="currentColor" r="2">
        <animate
          attributeName="cy"
          begin="ellipsis1.begin+0.2s"
          calcMode="spline"
          dur="0.6s"
          id="ellipsis3"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
          values="12;6;12"
        />
      </circle>
    </svg>
  );
};

const Ring = ({ size = 24, ...props }: SpinnerVariantProps) => (
  <svg
    height={size}
    stroke="currentColor"
    viewBox="0 0 44 44"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Loading...</title>
    <g fill="none" fillRule="evenodd" strokeWidth="2">
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="0s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.165, 0.84, 0.44, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 20"
        />
        <animate
          attributeName="stroke-opacity"
          begin="0s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.3, 0.61, 0.355, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 0"
        />
      </circle>
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="-0.9s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.165, 0.84, 0.44, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 20"
        />
        <animate
          attributeName="stroke-opacity"
          begin="-0.9s"
          calcMode="spline"
          dur="1.8s"
          keySplines="0.3, 0.61, 0.355, 1"
          keyTimes="0; 1"
          repeatCount="indefinite"
          values="1; 0"
        />
      </circle>
    </g>
  </svg>
);

const Bars = ({ size = 24, ...props }: SpinnerVariantProps) => (
  <svg
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Loading...</title>
    <style>{`
      .spinner-bar {
        animation: spinner-bars-animation .8s linear infinite;
        animation-delay: -.8s;
      }
      .spinner-bars-2 {
        animation-delay: -.65s;
      }
      .spinner-bars-3 {
        animation-delay: -0.5s;
      }
      @keyframes spinner-bars-animation {
        0% {
          y: 1px;
          height: 22px;
        }
        93.75% {
          y: 5px;
          height: 14px;
          opacity: 0.2;
        }
      }
    `}</style>
    <rect
      className="spinner-bar"
      fill="currentColor"
      height="22"
      width="6"
      x="1"
      y="1"
    />
    <rect
      className="spinner-bar spinner-bars-2"
      fill="currentColor"
      height="22"
      width="6"
      x="9"
      y="1"
    />
    <rect
      className="spinner-bar spinner-bars-3"
      fill="currentColor"
      height="22"
      width="6"
      x="17"
      y="1"
    />
  </svg>
);

const Infinite = ({ size = 24, ...props }: SpinnerVariantProps) => (
  <svg
    height={size}
    preserveAspectRatio="xMidYMid"
    viewBox="0 0 100 100"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Loading...</title>
    <path
      d="M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40 C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z"
      fill="none"
      stroke="currentColor"
      strokeDasharray="205.271142578125 51.317785644531256"
      strokeLinecap="round"
      strokeWidth="10"
      style={{ transform: "scale(0.8)", transformOrigin: "50px 50px" }}
    >
      <animate
        attributeName="stroke-dashoffset"
        dur="2s"
        keyTimes="0;1"
        repeatCount="indefinite"
        values="0;256.58892822265625"
      />
    </path>
  </svg>
);

function spinnerSizeToPx(size: SpinnerVariantProps["size"], fallback: number) {
  if (typeof size === "number" && Number.isFinite(size)) return size;
  if (typeof size === "string") {
    const n = parseFloat(size);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

const Dots = ({ size = 14, className }: SpinnerVariantProps) => {
  const sizePx = spinnerSizeToPx(size, 14);
  const dot = Math.max(2.5, sizePx / 5);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-[3px] text-current",
        className,
      )}
      style={{ height: sizePx, minWidth: sizePx }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full bg-current/50 motion-safe:animate-pulse motion-reduce:opacity-60"
          style={{
            width: dot,
            height: dot,
            animationDelay: `${i * 0.16}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </span>
  );
};

export const Spinner = ({
  variant = "ring",
  label = LAST.innhold,
  decorative = false,
  ...props
}: SpinnerProps) => {
  const content = (() => {
    switch (variant) {
      case "circle":
        return <Circle {...props} />;
      case "pinwheel":
        return <Pinwheel {...props} />;
      case "circle-filled":
        return <CircleFilled {...props} />;
      case "ellipsis":
        return <Ellipsis {...props} />;
      case "ring":
        return <Ring {...props} />;
      case "bars":
        return <Bars {...props} />;
      case "infinite":
        return <Infinite {...props} />;
      case "dots":
        return <Dots {...props} />;
      default:
        return <Default {...props} />;
    }
  })();

  if (decorative) {
    return (
      <span className="inline-flex items-center gap-2" aria-hidden>
        {content}
      </span>
    );
  }

  return (
    <output className="inline-flex items-center gap-2" aria-live="polite">
      {content}
      <span className="sr-only">{label}</span>
    </output>
  );
};
