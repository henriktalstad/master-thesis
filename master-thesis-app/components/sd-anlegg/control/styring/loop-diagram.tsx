"use client";

import type {
  ControlLoopDiagram,
  ControlLoopNode,
} from "@/lib/sd-anlegg/control/control-types";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<
  ControlLoopNode["role"],
  { fill: string; stroke: string; text: string }
> = {
  disturbance: {
    fill: "var(--muted)",
    stroke: "var(--border)",
    text: "var(--muted-foreground)",
  },
  setpoint: {
    fill: "color-mix(in oklch, var(--chart-4) 18%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-4) 45%, transparent)",
    text: "var(--foreground)",
  },
  controller: {
    fill: "var(--muted)",
    stroke: "var(--border)",
    text: "var(--foreground)",
  },
  actuator: {
    fill: "color-mix(in oklch, var(--chart-1) 16%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-1) 40%, transparent)",
    text: "var(--foreground)",
  },
  sensor: {
    fill: "color-mix(in oklch, var(--chart-3) 14%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-3) 38%, transparent)",
    text: "var(--foreground)",
  },
  plant: {
    fill: "color-mix(in oklch, var(--primary) 10%, var(--background))",
    stroke: "color-mix(in oklch, var(--primary) 35%, transparent)",
    text: "var(--foreground)",
  },
  simulatedMpc: {
    fill: "color-mix(in oklch, var(--primary) 14%, var(--background))",
    stroke: "var(--primary)",
    text: "var(--primary)",
  },
};

const MOBILE_NODE_ORDER = [
  "outdoor",
  "supply_sp",
  "supply_sp_calc",
  "heating_valve",
  "supply_fan",
  "supply_temp",
  "extract_sp",
  "exhaust_fan",
  "extract_temp",
  "simulatedMpc",
  "energy",
] as const;

const SIMULATED_MPC_TARGETS = new Set(["supply_sp", "supply_fan", "heating_valve"]);

function nodeHalfWidth(node: ControlLoopNode): number {
  return node.role === "simulatedMpc" ? 58 : 46;
}

function nodeSize(node: ControlLoopNode): { w: number; h: number } {
  return node.role === "simulatedMpc" ? { w: 116, h: 58 } : { w: 92, h: 54 };
}

function LoopNodeBox({ node }: { node: ControlLoopNode }) {
  const style = ROLE_STYLES[node.role];
  const { w, h } = nodeSize(node);
  const unavailable = !node.available && node.role !== "simulatedMpc";

  return (
    <g transform={`translate(${node.x - w / 2}, ${node.y - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx={8}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={1.5}
        strokeDasharray={unavailable ? "4 3" : undefined}
        className={cn(unavailable && "opacity-60")}
      />
      <title>
        {unavailable ? `${node.label} — signal mangler i SD` : node.label}
      </title>
      <text
        x={w / 2}
        y={18}
        textAnchor="middle"
        className="fill-foreground text-[10px] font-medium"
      >
        {node.label}
      </text>
      <text
        x={w / 2}
        y={36}
        textAnchor="middle"
        style={{ fill: style.text }}
        className="text-[11px] font-semibold tabular-nums"
      >
        {node.value ?? "—"}
      </text>
    </g>
  );
}

function LoopLegend() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      {(
        [
          ["setpoint", "Settpunkt"],
          ["actuator", "Pådrag"],
          ["sensor", "Måling"],
          ["simulatedMpc", "Simulert forslag"],
        ] as const
      ).map(([role, label]) => (
        <span key={role} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm border"
            style={{
              background: ROLE_STYLES[role].fill,
              borderColor: ROLE_STYLES[role].stroke,
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function VerticalLoopFlow({
  diagram,
  variant,
}: {
  diagram: ControlLoopDiagram;
  variant: "default" | "hero";
}) {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));

  return (
    <div className={cn("flex flex-col items-stretch gap-1", variant === "hero" ? "lg:hidden" : "md:hidden")}>
      {MOBILE_NODE_ORDER.map((id, index) => {
        const node = nodeById.get(id);
        if (!node) return null;
        const style = ROLE_STYLES[node.role];
        const unavailable = !node.available && node.role !== "simulatedMpc";
        return (
          <div key={id} className="flex flex-col items-center">
            <div
              className={cn(
                "w-full max-w-xs rounded-lg border px-3 py-2 text-center",
                unavailable && "border-dashed opacity-60",
              )}
              style={{
                background: style.fill,
                borderColor: style.stroke,
              }}
            >
              <p className="text-[10px] font-medium text-foreground">{node.label}</p>
              <p
                className="mt-0.5 text-xs font-semibold tabular-nums"
                style={{ color: style.text }}
              >
                {node.value ?? "—"}
              </p>
            </div>
            {index < MOBILE_NODE_ORDER.length - 1 ? (
              <span className="my-0.5 text-muted-foreground" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        );
      })}
      <LoopLegend />
    </div>
  );
}

function edgePath(
  from: ControlLoopNode,
  to: ControlLoopNode,
  dashed: boolean,
): string {
  const fromHw = nodeHalfWidth(from);
  const toHw = nodeHalfWidth(to);

  if (dashed && from.role === "simulatedMpc" && SIMULATED_MPC_TARGETS.has(to.id)) {
    const startX = from.x - fromHw;
    const startY = from.y;
    const endX = to.x + toHw;
    const endY = to.y;
    const controlX = (startX + endX) / 2 - 24;
    const controlY = from.y + (to.y - from.y) * 0.35 - 18;
    return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
  }

  if (from.y === to.y) {
    return `M ${from.x + fromHw} ${from.y} L ${to.x - toHw} ${to.y}`;
  }

  const startX = from.x;
  const startY = from.y + (from.y < to.y ? nodeSize(from).h / 2 : -nodeSize(from).h / 2);
  const endX = to.x;
  const endY = to.y + (to.y > from.y ? -nodeSize(to).h / 2 : nodeSize(to).h / 2);
  const midY = (startY + endY) / 2;
  return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
}

function EdgeLabel({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  const padX = 4;
  const textWidth = label.length * 5.2 + padX * 2;
  return (
    <g transform={`translate(${x - textWidth / 2}, ${y - 8})`}>
      <rect
        width={textWidth}
        height={14}
        rx={3}
        fill="var(--background)"
        fillOpacity={0.92}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
      <text
        x={textWidth / 2}
        y={10}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
      >
        {label}
      </text>
    </g>
  );
}

function HorizontalLoopSvg({
  diagram,
  variant,
}: {
  diagram: ControlLoopDiagram;
  variant: "default" | "hero";
}) {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const isHero = variant === "hero";

  return (
    <div className={cn(isHero ? "block" : "hidden md:block")}>
      <svg
        viewBox="0 0 1024 220"
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          "mx-auto h-auto w-full",
          isHero ? "max-w-6xl" : "max-w-4xl",
        )}
        role="img"
        aria-label={`Styringsloop for aggregat ${diagram.unitKey}`}
      >
        <text x={16} y={20} className="fill-muted-foreground text-[11px] font-medium">
          Tilluft og varme
        </text>
        <text x={16} y={154} className="fill-muted-foreground text-[11px] font-medium">
          Avtrekk (komfortproxy)
        </text>
        <line
          x1={28}
          y1={118}
          x2={996}
          y2={118}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />

        {diagram.edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;

          const path = edgePath(from, to, edge.dashed ?? false);
          const labelPos =
            edge.dashed && from.role === "simulatedMpc"
              ? { x: (from.x + to.x) / 2 - 8, y: Math.min(from.y, to.y) - 14 }
              : {
                  x: (from.x + to.x) / 2,
                  y: (from.y + to.y) / 2 - (from.y === to.y ? 10 : 0),
                };

          return (
            <g key={`${edge.from}-${edge.to}`}>
              <path
                d={path}
                fill="none"
                stroke={edge.dashed ? "var(--primary)" : "var(--muted-foreground)"}
                strokeWidth={edge.dashed ? 1.5 : 1}
                strokeDasharray={edge.dashed ? "5 4" : undefined}
                markerEnd="url(#control-loop-arrow)"
                opacity={edge.dashed ? 0.85 : 0.5}
              />
              {edge.label ? (
                <EdgeLabel x={labelPos.x} y={labelPos.y} label={edge.label} />
              ) : null}
            </g>
          );
        })}

        <defs>
          <marker
            id="control-loop-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--muted-foreground)" opacity={0.6} />
          </marker>
        </defs>

        {diagram.nodes.map((node) => (
          <LoopNodeBox key={node.id} node={node} />
        ))}
      </svg>
      <LoopLegend />
    </div>
  );
}

export function SdAnleggControlLoopDiagram({
  diagram,
  variant = "default",
}: {
  diagram: ControlLoopDiagram;
  variant?: "default" | "hero";
}) {
  return (
    <div className="@container">
      <VerticalLoopFlow diagram={diagram} variant={variant} />
      <HorizontalLoopSvg diagram={diagram} variant={variant} />
    </div>
  );
}
