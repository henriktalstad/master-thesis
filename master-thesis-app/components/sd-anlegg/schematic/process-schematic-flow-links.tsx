"use client";

import { useMemo } from "react";
import {
  buildHeatingBranchJunctions,
  buildHxBridgeSegments,
  buildProcessDuctCenterSpines,
  buildProcessFlowChevrons,
  buildProcessFlowLinkSegments,
} from "@/lib/sd-anlegg/process-schematic-flow-links";
import { processSchematicViewBoxString } from "@/lib/sd-anlegg/process-schematic-geometry";
import { PROCESS_SCHEMATIC_SVG as S } from "@/lib/sd-anlegg/process-schematic-svg-vars";

function FlowChevron({
  cx,
  cy,
  direction,
}: {
  cx: number;
  cy: number;
  direction: "left" | "right";
}) {
  const points =
    direction === "left"
      ? `${cx + 4},${cy - 3.5} ${cx - 2},${cy} ${cx + 4},${cy + 3.5}`
      : `${cx - 4},${cy - 3.5} ${cx + 2},${cy} ${cx - 4},${cy + 3.5}`;

  return (
    <polygon points={points} fill={S.ductStroke} fillOpacity="0.28" />
  );
}

export function ProcessSchematicFlowLinks() {
  const spines = useMemo(() => buildProcessDuctCenterSpines(), []);
  const chevrons = useMemo(() => buildProcessFlowChevrons(), []);
  const links = useMemo(() => buildProcessFlowLinkSegments(), []);
  const hxBridge = useMemo(() => buildHxBridgeSegments(), []);
  const heatingJunctions = useMemo(() => buildHeatingBranchJunctions(), []);

  return (
    <svg
      aria-hidden
      viewBox={processSchematicViewBoxString()}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {spines.map((spine) => (
        <line
          key={spine.lane}
          x1={spine.x1}
          y1={spine.y1}
          x2={spine.x2}
          y2={spine.y2}
          stroke={S.ductStroke}
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeDasharray="6 5"
        />
      ))}

      {chevrons.map((chevron) => (
        <FlowChevron
          key={`${chevron.direction}-${chevron.cx}-${chevron.cy}`}
          cx={chevron.cx}
          cy={chevron.cy}
          direction={chevron.direction}
        />
      ))}

      {hxBridge.map((segment, index) => (
        <line
          key={`hx-${index}`}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={S.pipeStroke}
          strokeOpacity={0.55}
          strokeWidth={1.75}
        />
      ))}

      {heatingJunctions.map((junction, index) => (
        <circle
          key={`heat-junction-${index}`}
          cx={junction.cx}
          cy={junction.cy}
          r={index < 2 ? 3.5 : 3}
          fill={S.ductFill}
          stroke={S.pipeStroke}
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
      ))}

      {links.map((link, index) => (
        <line
          key={`${link.slotId}-${link.kind}-${index}`}
          x1={link.x1}
          y1={link.y1}
          x2={link.x2}
          y2={link.y2}
          stroke={link.kind === "pipe-tap" ? S.pipeStroke : S.ductStroke}
          strokeOpacity={
            link.kind === "in-duct" ? 0.55
            : link.kind === "pipe-tap" ? 0.78
            : 0.48
          }
          strokeWidth={
            link.kind === "in-duct" ? 1.75
            : link.kind === "pipe-tap" ? 1.65
            : 1.35
          }
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
