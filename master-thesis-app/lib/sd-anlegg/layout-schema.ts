import { z } from "zod";
import { SD_COMPONENT_TYPES } from "./component-types";

export const sdLayoutBindingSchema = z.object({
  objectId: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  role: z.enum(["primary", "secondary"]).optional(),
});

export const sdLayoutNodeSchema = z.object({
  id: z.string().min(1),
  componentType: z.enum(SD_COMPONENT_TYPES),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  bindings: z.array(sdLayoutBindingSchema).min(1),
  label: z.string().optional(),
  lane: z
    .enum(["supply", "exhaust", "heat_recovery", "heating", "status"])
    .optional(),
  metadata: z
    .object({
      displayOrder: z.number().optional(),
    })
    .optional(),
});

export const sdLayoutEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  edgeType: z.enum(["duct", "pipe"]).default("duct"),
});

export const sdLayoutSchema = z.object({
  version: z.literal(1),
  nodes: z.array(sdLayoutNodeSchema),
  edges: z.array(sdLayoutEdgeSchema),
});

export type SdLayout = z.infer<typeof sdLayoutSchema>;
export type SdLayoutNode = z.infer<typeof sdLayoutNodeSchema>;
export type SdLayoutEdge = z.infer<typeof sdLayoutEdgeSchema>;
export type SdLayoutBinding = z.infer<typeof sdLayoutBindingSchema>;

export function parseSdLayout(input: unknown): SdLayout | null {
  const parsed = sdLayoutSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function normalizeSdLayout(input: SdLayout | null | undefined): SdLayout | null {
  if (!input) return null;
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return null;
  if (input.version !== 1) return null;
  return input;
}

export function sdLayoutHasNodes(layout: SdLayout | null | undefined): boolean {
  return normalizeSdLayout(layout)?.nodes.length ? true : false;
}
