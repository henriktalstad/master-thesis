"use client";

import { cn } from "@/lib/utils";
import {
  resolveProcessSymbolAnchorShiftY,
  resolveProcessSlotAnchorGrow,
  type ProcessSlotAnchorGrow,
} from "@/lib/sd-anlegg/process-schematic-slot-anchors";
import {
  PROCESS_DUCT_GEOMETRY as G,
  PROCESS_HEATING_PIPE as P,
  processSchematicViewBoxString,
} from "@/lib/sd-anlegg/process-schematic-geometry";
import { PROCESS_SCHEMATIC_SVG as S } from "@/lib/sd-anlegg/process-schematic-svg-vars";

const DUCT_TOP_Y = G.topY;
const DUCT_HEIGHT = G.height;
const DUCT_LEFT = G.left;
const DUCT_WIDTH = G.width;
const SUPPLY_Y = G.supplyY;

function ProcessDuctFlowCap({
  cx,
  cy,
  fill,
  stroke,
  arrowFill,
  arrowDirection,
}: {
  cx: number;
  cy: number;
  fill: string;
  stroke: string;
  arrowFill: string;
  /** Pil peker i luftstrømretning (venstre→høyre i skjemaet). */
  arrowDirection: "left" | "right";
}) {
  const r = 11;
  const arrow =
    arrowDirection === "right"
      ? `${cx + 6},${cy} ${cx - 3},${cy - 4.5} ${cx - 3},${cy + 4.5}`
      : `${cx - 6},${cy} ${cx + 3},${cy - 4.5} ${cx + 3},${cy + 4.5}`;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5" />
      <polygon points={arrow} fill={arrowFill} />
    </g>
  );
}

export function ProcessDuctCanvas() {
  const exhaustCenterY = DUCT_TOP_Y + DUCT_HEIGHT / 2;
  const supplyCenterY = SUPPLY_Y + DUCT_HEIGHT / 2;
  const supplyBottom = SUPPLY_Y + DUCT_HEIGHT;
  const ductRight = DUCT_LEFT + DUCT_WIDTH;
  const hxInnerLeft = G.hxX + 4;
  const hxInnerRight = G.hxX + G.hxWidth - 4;
  const hxCenterX = G.hxX + G.hxWidth / 2;

  return (
    <svg
      aria-hidden
      viewBox={processSchematicViewBoxString()}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="process-duct-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={S.ductHighlight} stopOpacity="0.95" />
          <stop offset="18%" stopColor={S.ductFill} stopOpacity="1" />
          <stop offset="100%" stopColor={S.ductFill} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="process-hx-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={S.hxFill} stopOpacity="1" />
          <stop offset="50%" stopColor={S.ductHighlight} stopOpacity="1" />
          <stop offset="100%" stopColor={S.hxFill} stopOpacity="1" />
        </linearGradient>
        <pattern
          id="process-filter-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke={S.hatchStroke}
            strokeOpacity="0.38"
            strokeWidth="1.25"
          />
        </pattern>
      </defs>

      <rect
        x={DUCT_LEFT}
        y={DUCT_TOP_Y}
        width={DUCT_WIDTH}
        height={DUCT_HEIGHT}
        rx="2"
        fill="url(#process-duct-sheen)"
        stroke={S.ductStroke}
        strokeOpacity="0.42"
        strokeWidth="1"
      />

      <rect
        x={DUCT_LEFT}
        y={SUPPLY_Y}
        width={DUCT_WIDTH}
        height={DUCT_HEIGHT}
        rx="2"
        fill="url(#process-duct-sheen)"
        stroke={S.ductStroke}
        strokeOpacity="0.42"
        strokeWidth="1"
      />

      <rect
        x={G.hxX}
        y={DUCT_TOP_Y - 2}
        width={G.hxWidth}
        height={supplyBottom - DUCT_TOP_Y + 4}
        rx="2"
        fill="url(#process-hx-sheen)"
        stroke={S.ductStroke}
        strokeOpacity="0.32"
        strokeWidth="1"
      />
      {[72, 112, 152, 192, 232, 272, 312].map((y) => (
        <line
          key={y}
          x1={hxInnerLeft}
          y1={y}
          x2={hxInnerRight}
          y2={y}
          stroke={S.pipeStroke}
          strokeOpacity="0.55"
          strokeWidth="1.25"
        />
      ))}
      <line
        x1={hxCenterX}
        y1={DUCT_TOP_Y + DUCT_HEIGHT}
        x2={hxCenterX}
        y2={SUPPLY_Y}
        stroke={S.pipeStroke}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />

      <path
        d={`M ${P.leftPipeX} ${SUPPLY_Y + 6} V ${P.topY} M ${P.rightPipeX} ${SUPPLY_Y + 6} V ${P.topY} M ${P.leftPipeX} ${P.topY} H ${P.rightPipeX} M ${P.leftPipeX} ${P.bypassY} H ${P.rightPipeX} M ${P.coolValveX} ${SUPPLY_Y + 8} V ${P.topY + 28}`}
        fill="none"
        stroke={S.pipeStroke}
        strokeOpacity="0.88"
        strokeWidth="3.75"
        strokeLinejoin="round"
      />
      <rect
        x={P.leftPipeX - 12}
        y={P.topY - 4}
        width={P.rightPipeX - P.leftPipeX + 24}
        height={P.bypassY - P.topY + 8}
        rx="3"
        fill="none"
        stroke={S.pipeStroke}
        strokeOpacity="0.28"
        strokeWidth="1.15"
        strokeDasharray="5 4"
      />
      <circle cx={P.leftPipeX} cy={SUPPLY_Y + DUCT_HEIGHT / 2} r="4" fill={S.ductFill} stroke={S.pipeStroke} strokeOpacity="0.85" strokeWidth="1.5" />
      <circle cx={P.rightPipeX} cy={SUPPLY_Y + DUCT_HEIGHT / 2} r="4" fill={S.ductFill} stroke={S.pipeStroke} strokeOpacity="0.85" strokeWidth="1.5" />
      <circle cx={P.coolValveX} cy={SUPPLY_Y + DUCT_HEIGHT - 2} r="3.5" fill={S.ductFill} stroke={S.pipeStroke} strokeOpacity="0.85" strokeWidth="1.35" />

      <g transform={`translate(${P.coolValveX - 18}, ${SUPPLY_Y + 14})`}>
        <rect
          x="0"
          y="0"
          width="36"
          height={DUCT_HEIGHT - 28}
          rx="1.5"
          fill={S.ductHighlight}
          stroke={S.pipeStroke}
          strokeOpacity="0.55"
          strokeWidth="1.25"
        />
        <text x="10" y="22" fontSize="14" fontWeight="700" fill={S.pipeStroke} opacity="0.75">
          +
        </text>
        <text x="22" y="22" fontSize="14" fontWeight="700" fill={S.pipeStroke} opacity="0.75">
          −
        </text>
        <line x1="18" y1="4" x2="18" y2={DUCT_HEIGHT - 32} stroke={S.pipeStroke} strokeOpacity="0.35" strokeWidth="1" />
      </g>

      <path
        d={`M ${(P.leftPipeX + P.rightPipeX) / 2 - 10} ${P.bypassY - 6} L ${(P.leftPipeX + P.rightPipeX) / 2 + 10} ${P.bypassY + 6} M ${(P.leftPipeX + P.rightPipeX) / 2 - 10} ${P.bypassY + 6} L ${(P.leftPipeX + P.rightPipeX) / 2 + 10} ${P.bypassY - 6}`}
        fill="none"
        stroke={S.pipeStroke}
        strokeOpacity="0.55"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      <rect
        x={G.filterX}
        y={DUCT_TOP_Y + 8}
        width={G.filterWidth}
        height={DUCT_HEIGHT - 16}
        rx="1"
        fill="url(#process-filter-hatch)"
        stroke={S.ductStroke}
        strokeOpacity="0.3"
        strokeWidth="0.75"
      />
      <rect
        x={G.filterX}
        y={SUPPLY_Y + 8}
        width={G.filterWidth}
        height={DUCT_HEIGHT - 16}
        rx="1"
        fill="url(#process-filter-hatch)"
        stroke={S.ductStroke}
        strokeOpacity="0.3"
        strokeWidth="0.75"
      />

      <ProcessDuctFlowCap
        cx={DUCT_LEFT + 10}
        cy={exhaustCenterY}
        fill={S.flowOutdoorBg}
        stroke={S.flowOutdoor}
        arrowFill={S.flowOutdoor}
        arrowDirection="right"
      />
      <ProcessDuctFlowCap
        cx={ductRight - 10}
        cy={exhaustCenterY}
        fill={S.flowNeutralBg}
        stroke={S.pipeStroke}
        arrowFill={S.pipeStroke}
        arrowDirection="right"
      />
      <ProcessDuctFlowCap
        cx={DUCT_LEFT + 10}
        cy={supplyCenterY}
        fill={S.flowSupplyBg}
        stroke={S.flowSupply}
        arrowFill={S.flowSupply}
        arrowDirection="right"
      />
      <ProcessDuctFlowCap
        cx={ductRight - 10}
        cy={supplyCenterY}
        fill={S.flowExhaustBg}
        stroke={S.flowExhaust}
        arrowFill={S.flowExhaust}
        arrowDirection="right"
      />
    </svg>
  );
}

export function ProcessDuctSlotAnchor({
  x,
  anchorY,
  slotRole,
  lane,
  anchorAlign = "center",
  anchorGrow = "center",
  className,
  children,
}: {
  x: number;
  anchorY: number;
  slotRole: string;
  lane?: string;
  anchorAlign?: "center" | "pipe-left" | "pipe-right";
  anchorGrow?: ProcessSlotAnchorGrow;
  className?: string;
  children: React.ReactNode;
}) {
  const resolvedGrow =
    anchorGrow === "center" ? resolveProcessSlotAnchorGrow(lane ?? "", slotRole) : anchorGrow;
  const translateX =
    anchorAlign === "pipe-left"
      ? "-100%"
      : anchorAlign === "pipe-right"
        ? "0%"
        : "-50%";
  const translateY =
    resolvedGrow === "up" ? "-100%"
    : resolvedGrow === "down" ? "0%"
    : `-${resolveProcessSymbolAnchorShiftY(slotRole, lane)}%`;
  const shiftY = resolvedGrow === "center" ? resolveProcessSymbolAnchorShiftY(slotRole, lane) : 0;

  return (
    <div
      className={cn("absolute", className)}
      style={{
        left: `${x}%`,
        top: `${anchorY}%`,
        transform: `translateX(${translateX}) translateY(${translateY})`,
      }}
    >
      <div
        className="relative z-10 w-max"
        style={
          resolvedGrow === "center" ? { transform: `translateY(-${shiftY}%)` } : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
