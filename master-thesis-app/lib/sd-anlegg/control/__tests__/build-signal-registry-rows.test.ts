import { describe, expect, test } from "bun:test";
import { buildSignalRegistryRows } from "@/lib/sd-anlegg/control/build-signal-registry-rows";
import {
  materializeSorgenfriControlBindings,
  SORGENFRI_VENTILATION_UNIT_KEY,
} from "@/lib/sd-anlegg/control/sorgenfri-control-bindings";
import { mergeControlSignalBindings } from "@/lib/sd-anlegg/control/control-signal-bindings";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";

function point(
  objectId: string,
  objectName: string,
  description = "",
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "Nærbyen",
    objectId,
    objectName,
    description,
    unit: null,
    lastValue: null,
    lastSampledAt: null,
    valueSource: "postgres-sync",
    quality: null,
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
  };
}

describe("build-signal-registry-rows", () => {
  test("har én rad per fysisk punkt uten dobbelttelling", () => {
    const points = [
      point("AV-40372", "AO_3"),
      point("AV-40395", "Efficiency", "Efficiency for exchanger"),
      point("AO-3", "320.003SB502_C", "Varmeventil"),
      point("BI-1", "310.001JP501_A", "Pumpe"),
    ];
    const bindings = mergeControlSignalBindings(
      [],
      materializeSorgenfriControlBindings({ sourceId: "src-1", points }),
      [],
    );
    const rows = buildSignalRegistryRows({
      points,
      context: { sourceId: "src-1", bindings, unitKey: SORGENFRI_VENTILATION_UNIT_KEY },
    });

    const physical = rows.filter((row) => !row.catalogOnly);
    expect(physical).toHaveLength(4);
    expect(new Set(physical.map((row) => row.objectId)).size).toBe(4);

    const ahuValve = physical.find((row) => row.objectId === "AV-40372");
    expect(ahuValve?.canonicalId).toBe("heating.valve.command");

    const fjvValve = physical.find((row) => row.objectId === "AO-3");
    expect(fjvValve?.canonicalId).toBe("district.tr003.valve.command");
    expect(fjvValve?.application).toBe("district_actuator");
  });
});
