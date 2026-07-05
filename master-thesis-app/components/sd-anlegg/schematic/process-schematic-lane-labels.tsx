"use client";

import {
  PROCESS_DUCT_GEOMETRY as G,
  PROCESS_LANE_LABEL_X,
  processSchematicLayoutPercentX,
  processSchematicLayoutPercentY,
} from "@/lib/sd-anlegg/process-schematic-geometry";
import { SD_ANLEGG_PROCESS_LANE_LABEL } from "./styles/process-schematic-styles";

const LANE_LABEL_X = processSchematicLayoutPercentX(PROCESS_LANE_LABEL_X);
const EXHAUST_DUCT_CENTER_Y = G.topY + G.height / 2;
const SUPPLY_DUCT_CENTER_Y = G.supplyY + G.height / 2;
const EXHAUST_LABEL_Y = processSchematicLayoutPercentY(EXHAUST_DUCT_CENTER_Y);
const SUPPLY_LABEL_Y = processSchematicLayoutPercentY(SUPPLY_DUCT_CENTER_Y);

export function ProcessSchematicLaneLabels() {
  return (
    <>
      <span
        className={SD_ANLEGG_PROCESS_LANE_LABEL}
        style={{ left: `${LANE_LABEL_X}%`, top: `${EXHAUST_LABEL_Y}%` }}
      >
        Avtrekk
      </span>
      <span
        className={SD_ANLEGG_PROCESS_LANE_LABEL}
        style={{ left: `${LANE_LABEL_X}%`, top: `${SUPPLY_LABEL_Y}%` }}
      >
        Tilluft
      </span>
    </>
  );
}
