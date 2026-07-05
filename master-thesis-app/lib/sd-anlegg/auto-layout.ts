import { getSdComponentDefinition } from "./component-registry";
import type { SdLayout, SdLayoutEdge, SdLayoutNode } from "./layout-schema";

const H_GAP = 200;
const V_GAP = 130;
const ORIGIN_X = 48;
const SUPPLY_Y = 200;
const EXHAUST_Y = 72;
const HEATING_Y = SUPPLY_Y + V_GAP * 2;
const STATUS_Y = HEATING_Y + V_GAP;
const SENSOR_OFFSET_Y = -88;

function ductEdges(edges: readonly SdLayoutEdge[]): SdLayoutEdge[] {
  return edges.filter((edge) => edge.edgeType === "duct");
}

function assignDuctLevels(
  nodes: readonly SdLayoutNode[],
  edges: readonly SdLayoutEdge[],
): Map<string, number> {
  const ids = nodes.map((node) => node.id);
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of ids) {
    inDegree.set(id, 0);
    outgoing.set(id, []);
  }

  for (const edge of ductEdges(edges)) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const levels = new Map<string, number>();
  let queue = ids.filter((id) => (inDegree.get(id) ?? 0) === 0);
  for (const id of queue) levels.set(id, 0);

  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const current of queue) {
      const level = levels.get(current) ?? 0;
      for (const target of outgoing.get(current) ?? []) {
        levels.set(target, Math.max(levels.get(target) ?? 0, level + 1));
        inDegree.set(target, (inDegree.get(target) ?? 1) - 1);
        if ((inDegree.get(target) ?? 0) === 0) {
          nextQueue.push(target);
        }
      }
    }
    queue = nextQueue;
  }

  for (const id of ids) {
    if (!levels.has(id)) levels.set(id, 0);
  }

  return levels;
}

function isSensorNode(node: SdLayoutNode): boolean {
  return node.componentType.startsWith("sensor.");
}

function isHeatingNode(node: SdLayoutNode): boolean {
  return node.componentType.startsWith("hvac.");
}

function isStatusNode(node: SdLayoutNode): boolean {
  return node.componentType === "binary.status";
}

function inferLaneY(node: SdLayoutNode, layout: SdLayout): number {
  const haystack = [
    node.label ?? "",
    node.bindings[0]?.objectId ?? "",
    node.id,
  ]
    .join(" ")
    .toLowerCase();

  if (isSensorNode(node)) return SUPPLY_Y + SENSOR_OFFSET_Y;
  if (isHeatingNode(node)) return HEATING_Y;
  if (isStatusNode(node)) return STATUS_Y;

  if (/exhaust|avtrekk|eaf|401|502|901/.test(haystack) || /lane-exhaust/.test(node.id)) {
    return EXHAUST_Y;
  }

  const hasExhaustEdge = layout.edges.some(
    (edge) =>
      edge.edgeType === "duct" &&
      (edge.source === node.id || edge.target === node.id) &&
      layout.nodes.some(
        (other) =>
          other.id !== node.id &&
          (other.id === edge.source || other.id === edge.target) &&
          /exhaust|avtrekk|401|502|901/.test(
            `${other.label ?? ""} ${other.bindings[0]?.objectId ?? ""} ${other.id}`.toLowerCase(),
          ),
      ),
  );

  if (hasExhaustEdge && /401|502|901|avtrekk|extract/.test(haystack)) {
    return EXHAUST_Y;
  }

  return SUPPLY_Y;
}

function neighborLevel(
  nodeId: string,
  layout: SdLayout,
  levels: Map<string, number>,
): number {
  let max = 0;
  for (const edge of layout.edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue;
    const other = edge.source === nodeId ? edge.target : edge.source;
    max = Math.max(max, levels.get(other) ?? 0);
  }
  return max;
}

export function applySdAnleggAutoLayout(layout: SdLayout): SdLayout {
  const levels = assignDuctLevels(layout.nodes, layout.edges);
  const maxDuctLevel = Math.max(0, ...levels.values());
  const positioned = new Map<string, { x: number; y: number }>();

  const mainNodes = layout.nodes.filter(
    (node) => !isSensorNode(node) && !isHeatingNode(node) && !isStatusNode(node),
  );
  const heatingNodes = layout.nodes.filter(isHeatingNode);
  const sensorNodes = layout.nodes.filter(isSensorNode);
  const statusNodes = layout.nodes.filter(isStatusNode);

  const supplyNodes = mainNodes.filter((node) => inferLaneY(node, layout) === SUPPLY_Y);
  const exhaustNodes = mainNodes.filter((node) => inferLaneY(node, layout) === EXHAUST_Y);

  function placeByLevel(nodes: readonly SdLayoutNode[], baseY: number) {
    const byLevel = new Map<number, SdLayoutNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.id) ?? 0;
      const list = byLevel.get(level) ?? [];
      list.push(node);
      byLevel.set(level, list);
    }

    for (const [level, group] of byLevel) {
      group.forEach((node, index) => {
        positioned.set(node.id, {
          x: ORIGIN_X + level * H_GAP,
          y: baseY + index * 18,
        });
      });
    }
  }

  placeByLevel(supplyNodes, SUPPLY_Y);
  placeByLevel(exhaustNodes, EXHAUST_Y);

  heatingNodes.forEach((node, index) => {
    const level = neighborLevel(node.id, layout, levels);
    positioned.set(node.id, {
      x: ORIGIN_X + level * H_GAP,
      y: HEATING_Y + index * 24,
    });
  });

  sensorNodes.forEach((node, index) => {
    const level =
      neighborLevel(node.id, layout, levels) || Math.floor(maxDuctLevel / 2);
    const parentY = inferLaneY(
      layout.nodes.find(
        (entry) =>
          entry.id !== node.id &&
          layout.edges.some(
            (edge) =>
              edge.target === node.id &&
              (edge.source === entry.id || edge.target === entry.id),
          ),
      ) ?? node,
      layout,
    );
    positioned.set(node.id, {
      x: ORIGIN_X + level * H_GAP + 56,
      y: parentY + SENSOR_OFFSET_Y + index * 28,
    });
  });

  statusNodes.forEach((node, index) => {
    positioned.set(node.id, {
      x: ORIGIN_X + (maxDuctLevel + 1) * H_GAP,
      y: STATUS_Y + index * 22,
    });
  });

  return {
    ...layout,
    nodes: layout.nodes.map((node) => ({
      ...node,
      position: positioned.get(node.id) ?? node.position,
    })),
  };
}

export function sdAnleggNodeDimensions(node: SdLayoutNode): {
  width: number;
  height: number;
} {
  const size = getSdComponentDefinition(node.componentType)?.defaultSize;
  if (node.componentType.startsWith("sensor.")) {
    return { width: 88, height: 48 };
  }
  return {
    width: size?.width ?? 128,
    height: size?.height ?? 72,
  };
}
