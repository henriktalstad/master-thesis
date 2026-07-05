"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { m } from "@/lib/motion/m";

export interface DonutChartSegment {
  value: number;
  color: string; // Should be a valid CSS color (e.g., hsl(var(--primary)))
  label: string;
  [key: string]: unknown; // Allow other data
}

type DonutChartProps = React.ComponentProps<"div"> & {
  data: DonutChartSegment[];
  totalValue?: number;
  size?: number;
  strokeWidth?: number;
  animationDuration?: number;
  animationDelayPerSegment?: number;
  highlightOnHover?: boolean;
  centerContent?: React.ReactNode;
  /** Callback function when a segment is hovered */
  onSegmentHover?: (segment: DonutChartSegment | null) => void;
  /** Callback function when a segment is clicked */
  onSegmentClick?: (segment: DonutChartSegment | null) => void;
  /** Array of segment labels that should be highlighted/selected */
  selectedSegments?: string[];
};

const EMPTY_SELECTED_SEGMENTS: string[] = [];

function DonutChart({
  ref,
  data,
  totalValue: propTotalValue,
  size = 200,
  strokeWidth = 20,
  animationDuration = 1,
  animationDelayPerSegment = 0.05,
  highlightOnHover = true,
  centerContent,
  onSegmentHover,
  onSegmentClick,
  selectedSegments = EMPTY_SELECTED_SEGMENTS,
  className,
  ...props
}: DonutChartProps) {
  const [hoveredSegment, setHoveredSegment] =
    React.useState<DonutChartSegment | null>(null);

  const internalTotalValue = React.useMemo(
    () =>
      propTotalValue || data.reduce((sum, segment) => sum + segment.value, 0),
    [data, propTotalValue],
  );

  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative percentages for each segment
  const segmentsWithOffset = React.useMemo(() => {
    return data.reduce<
      Array<{
        segment: DonutChartSegment;
        percentage: number;
        offset: number;
      }>
    >((acc, segment) => {
      if (segment.value === 0) {
        return acc;
      }
      const percentage =
        internalTotalValue === 0
          ? 0
          : (segment.value / internalTotalValue) * 100;
      const prevOffset = acc.length > 0 ? acc[acc.length - 1]!.offset : 0;
      const prevPercentage =
        acc.length > 0 ? acc[acc.length - 1]!.percentage : 0;
      const offset = prevOffset + prevPercentage;
      acc.push({ segment, percentage, offset });
      return acc;
    }, []);
  }, [data, internalTotalValue]);

  // Effect to call the onSegmentHover prop when internal state changes
  React.useEffect(() => {
    onSegmentHover?.(hoveredSegment);
  }, [hoveredSegment, onSegmentHover]);

  const handleMouseLeave = () => {
    setHoveredSegment(null);
  };

  // Hvis ingen data, vis tom ring
  if (data.length === 0 || segmentsWithOffset.length === 0) {
    return (
      <div
        ref={ref}
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="hsl(var(--border) / 0.5)"
            strokeWidth={strokeWidth}
          />
        </svg>
        {centerContent ? (
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{
              width: size - strokeWidth * 2.5,
              height: size - strokeWidth * 2.5,
            }}
          >
            {centerContent}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible -rotate-90" // Rotate to start at 12 o'clock
      >
        {/* Base background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="hsl(var(--border) / 0.5)" // Use theme variable for bg
          strokeWidth={strokeWidth}
          className="pointer-events-none"
        />

        {/* Data Segments */}
        {segmentsWithOffset.map(({ segment, percentage, offset }, index) => {
          if (segment.value === 0) return null;

          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = (offset / 100) * circumference;

          const isHovered = hoveredSegment?.label === segment.label;
          const isSelected = selectedSegments.includes(segment.label);
          const isActive = isHovered || isSelected;
          const isIsolated = selectedSegments.length > 0 && !isSelected;

          return (
            <m.circle
              key={segment.label || `segment-${index}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={-strokeDashoffset} // Negative offset to draw correctly
              strokeLinecap="round" // Makes rounded edges
              initial={{ opacity: 0, strokeDashoffset: circumference }}
              animate={{
                opacity: isIsolated ? 0.2 : 1,
                strokeDashoffset: -strokeDashoffset,
              }}
              transition={{
                opacity: {
                  duration: 0.2,
                  delay: index * animationDelayPerSegment,
                },
                strokeDashoffset: {
                  duration: animationDuration,
                  delay: index * animationDelayPerSegment,
                  ease: "easeOut",
                },
              }}
              className={cn(
                "origin-center transition-transform duration-200",
                (highlightOnHover || onSegmentClick) && "cursor-pointer",
              )}
              style={{
                filter: isActive
                  ? `drop-shadow(0px 0px 8px ${segment.color}) brightness(1.15)`
                  : isIsolated
                    ? "brightness(0.3)"
                    : "none",
                transform: isActive
                  ? "scale(1.05)"
                  : isIsolated
                    ? "scale(0.95)"
                    : "scale(1)",
                transition: "filter 0.2s ease-out, transform 0.2s ease-out",
              }}
              onMouseEnter={() => setHoveredSegment(segment)}
              onClick={() => {
                if (onSegmentClick) {
                  // Toggle: hvis segmentet allerede er valgt, deselekt det
                  if (isSelected) {
                    onSegmentClick(null);
                  } else {
                    onSegmentClick(segment);
                  }
                }
              }}
            />
          );
        })}
      </svg>

      {/* Center Content */}
      {centerContent ? (
        <div
          className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{
            width: size - strokeWidth * 2.5, // Ensure content fits inside
            height: size - strokeWidth * 2.5,
          }}
        >
          {centerContent}
        </div>
      ) : null}
    </div>
  );
}

export { DonutChart };
