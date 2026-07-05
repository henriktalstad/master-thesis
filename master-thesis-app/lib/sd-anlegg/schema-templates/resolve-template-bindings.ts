import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { applySdAnleggAutoLayout } from "../auto-layout";
import type { SdLayout, SdLayoutEdge, SdLayoutNode } from "../layout-schema";
import { findBestBindingRuleMatch } from "./match-binding-rule";
import type { SchemaTemplate, TemplateBindingResult } from "./types";

function pointKey(point: InfraspawnPointListItem): string {
  return `${point.sourceId}:${point.objectId}`;
}

export function resolveTemplateBindings(
  template: SchemaTemplate,
  points: readonly InfraspawnPointListItem[],
  elementKey?: string | null,
): { layout: SdLayout; result: TemplateBindingResult } {
  const nodeById = new Map<string, SdLayoutNode>();
  const usedKeys = new Set<string>();
  const unboundRoleIds: string[] = [];

  for (const def of template.nodes) {
    const available = points.filter((point) => !usedKeys.has(pointKey(point)));
    const point = findBestBindingRuleMatch(available, def.bind, elementKey);
    if (!point) {
      unboundRoleIds.push(def.id);
      continue;
    }

    usedKeys.add(pointKey(point));
    nodeById.set(def.id, {
      id: def.id,
      componentType: def.componentType,
      lane: def.lane,
      position: { x: 0, y: 0 },
      bindings: [
        {
          objectId: point.objectId,
          sourceId: point.sourceId,
          role: "primary",
        },
      ],
      label:
        def.label ||
        point.description?.trim() ||
        point.objectName?.trim() ||
        point.objectId,
    });
  }

  const edges: SdLayoutEdge[] = [];
  for (const edge of template.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    edges.push({
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      edgeType: edge.edgeType ?? "duct",
    });
  }

  const layout = applySdAnleggAutoLayout({
    version: 1,
    nodes: [...nodeById.values()],
    edges,
  });

  return {
    layout,
    result: {
      template,
      layoutSource: "template",
      boundRoleCount: nodeById.size,
      unboundRoleIds,
    },
  };
}
