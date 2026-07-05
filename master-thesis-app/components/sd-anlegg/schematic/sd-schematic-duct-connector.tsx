"use client";

import {
  SD_ANLEGG_SCHEMATIC_CONNECTOR_FILL,
  SD_ANLEGG_SCHEMATIC_CONNECTOR_STROKE,
  type SdAnleggSchematicLaneVariant,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import type { LaneVariant } from "./sd-schematic-types";

export function SdSchematicDuctConnector({ variant }: { variant: LaneVariant }) {
  const lane = variant as SdAnleggSchematicLaneVariant;

  return (
    <svg
      viewBox="0 0 32 12"
      className="mx-0.5 h-3 w-8 shrink-0"
      aria-hidden
    >
      <line
        x1="0"
        y1="6"
        x2="22"
        y2="6"
        className={SD_ANLEGG_SCHEMATIC_CONNECTOR_STROKE[lane]}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <polygon
        points="22,2 32,6 22,10"
        className={SD_ANLEGG_SCHEMATIC_CONNECTOR_FILL[lane]}
      />
    </svg>
  );
}
