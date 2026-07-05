"use client";

import { useMemo, useState } from "react";
import {
  buildMpcArchitectureDiagram,
  MPC_ARCHITECTURE_GROUP_BOUNDS,
  MPC_ARCHITECTURE_VIEWBOX,
  type MpcArchitectureDiagram,
  type MpcArchitectureNode,
} from "@/lib/sd-anlegg/control/build-mpc-architecture-diagram";
import { CONTROL_ARCHITECTURE_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<
  MpcArchitectureNode["role"],
  { fill: string; stroke: string; legend: string }
> = {
  input: {
    fill: "color-mix(in oklch, var(--chart-2) 14%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-2) 40%, transparent)",
    legend: CONTROL_ARCHITECTURE_UI.legendInput,
  },
  constraint: {
    fill: "color-mix(in oklch, var(--chart-5) 14%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-5) 40%, transparent)",
    legend: CONTROL_ARCHITECTURE_UI.legendConstraint,
  },
  mpc: {
    fill: "color-mix(in oklch, var(--primary) 12%, var(--background))",
    stroke: "var(--primary)",
    legend: CONTROL_ARCHITECTURE_UI.legendMpc,
  },
  legacy: {
    fill: "var(--muted)",
    stroke: "var(--border)",
    legend: CONTROL_ARCHITECTURE_UI.legendLegacy,
  },
  evaluation: {
    fill: "color-mix(in oklch, var(--chart-3) 16%, var(--background))",
    stroke: "color-mix(in oklch, var(--chart-3) 42%, transparent)",
    legend: CONTROL_ARCHITECTURE_UI.legendEvaluation,
  },
};

const NODE_SIZE = { w: 112, h: 48 } as const;

type Props = {
  diagram?: MpcArchitectureDiagram;
  className?: string;
};

function nodeCenter(node: MpcArchitectureNode): { cx: number; cy: number } {
  return { cx: node.x, cy: node.y };
}

function edgeAnchor(
  from: MpcArchitectureNode,
  to: MpcArchitectureNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const { cx: x1, cy: y1 } = nodeCenter(from);
  const { cx: x2, cy: y2 } = nodeCenter(to);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const padX = (NODE_SIZE.w / 2) * (Math.abs(dx) / len);
  const padY = (NODE_SIZE.h / 2) * (Math.abs(dy) / len);
  return {
    x1: x1 + (padX * Math.sign(dx)) / 1.05,
    y1: y1 + (padY * Math.sign(dy)) / 1.05,
    x2: x2 - (padX * Math.sign(dx)) / 1.05,
    y2: y2 - (padY * Math.sign(dy)) / 1.05,
  };
}

function ArchitectureNodeBox({ node }: { node: MpcArchitectureNode }) {
  const style = ROLE_STYLES[node.role];
  const { w, h } = NODE_SIZE;

  return (
    <g transform={`translate(${node.x - w / 2}, ${node.y - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx={8}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={1.2}
      />
      <text
        x={w / 2}
        y={node.sublabel ? 19 : 26}
        textAnchor="middle"
        className="fill-foreground text-[10px] font-medium"
      >
        {node.label}
      </text>
      {node.sublabel ? (
        <text
          x={w / 2}
          y={34}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {node.sublabel}
        </text>
      ) : null}
    </g>
  );
}

export function SdAnleggMpcArchitectureDiagram({
  diagram: diagramProp,
  className,
}: Props) {
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const diagram = useMemo(
    () => diagramProp ?? buildMpcArchitectureDiagram(),
    [diagramProp],
  );
  const nodeById = useMemo(
    () => new Map(diagram.nodes.map((n) => [n.id, n])),
    [diagram.nodes],
  );

  const legendRoles = useMemo(() => {
    const seen = new Set<MpcArchitectureNode["role"]>();
    return diagram.nodes
      .map((n) => n.role)
      .filter((role) => {
        if (seen.has(role)) return false;
        seen.add(role);
        return true;
      });
  }, [diagram.nodes]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="w-full overflow-x-auto rounded-lg border border-border/60 bg-muted/10 px-2 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${MPC_ARCHITECTURE_VIEWBOX.w} ${MPC_ARCHITECTURE_VIEWBOX.h}`}
          className="mx-auto h-auto min-w-[560px] max-w-full"
          role="img"
          aria-label={CONTROL_ARCHITECTURE_UI.ariaLabel}
        >
          <defs>
            <marker
              id="mpc-arch-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--border)" />
            </marker>
          </defs>

          {diagram.groups.map((group) => {
            const bounds = MPC_ARCHITECTURE_GROUP_BOUNDS[group.id];
            if (!bounds) return null;
            return (
              <g key={group.id}>
                <text
                  x={bounds.x + 8}
                  y={bounds.y - 8}
                  className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
                >
                  {group.label}
                </text>
                <rect
                  x={bounds.x}
                  y={bounds.y}
                  width={bounds.w}
                  height={bounds.h}
                  rx={10}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray={bounds.dashed ? "5 4" : undefined}
                />
              </g>
            );
          })}

          {diagram.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const { x1, y1, x2, y2 } = edgeAnchor(from, to);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const labelOffsetY =
              edge.from === "database" && edge.to === "compare" ? 10 : -8;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    edge.dashed ? "var(--muted-foreground)" : "var(--border)"
                  }
                  strokeWidth={1.5}
                  strokeDasharray={edge.dashed ? "5 4" : undefined}
                  markerEnd="url(#mpc-arch-arrow)"
                />
                {showEdgeLabels && edge.label ? (
                  <g>
                    <rect
                      x={midX - 36}
                      y={midY + labelOffsetY - 9}
                      width={72}
                      height={14}
                      rx={3}
                      fill="var(--background)"
                      fillOpacity={0.92}
                    />
                    <text
                      x={midX}
                      y={midY + labelOffsetY}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[8px]"
                    >
                      {edge.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {diagram.nodes.map((node) => (
            <ArchitectureNodeBox key={node.id} node={node} />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
        <ul className="flex flex-wrap gap-2">
          {legendRoles.map((role) => {
            const style = ROLE_STYLES[role];
            return (
              <li
                key={role}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <span
                  className="size-2 shrink-0 rounded-sm border"
                  style={{
                    background: style.fill,
                    borderColor: style.stroke,
                  }}
                  aria-hidden
                />
                {style.legend}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setShowEdgeLabels((v) => !v)}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showEdgeLabels
            ? CONTROL_ARCHITECTURE_UI.hideEdgeLabels
            : CONTROL_ARCHITECTURE_UI.showEdgeLabels}
        </button>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        {CONTROL_ARCHITECTURE_UI.caption}
      </p>
    </div>
  );
}
