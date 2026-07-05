import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  isAhuAirflowInactive,
  resolveSfpStatusDisplayValue,
} from "@/lib/sd-anlegg/ahu-airflow-inactive";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { prepareAhuSchematicModel } from "@/lib/sd-anlegg/ahu-derived-slot-enrichment";

function point(
  overrides: Partial<InfraspawnPointListItem>,
): InfraspawnPointListItem {
  return {
    sourceId: "s1",
    sourceLabel: "360.102",
    objectId: "p1",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 0,
    lastSampledAt: "2026-06-20T09:00:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

const STOPPED_AHU: InfraspawnPointListItem[] = [
  point({
    objectId: "BO-601",
    objectName: "Systemstatus",
    unit: "boolean",
    lastValue: 0,
  }),
  point({
    objectId: "AV-SAF",
    objectName: "AI_SAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "AV-EAF",
    objectName: "AI_EAFFLOW",
    unit: "cubic-meters-per-hour",
    lastValue: 0,
  }),
  point({
    objectId: "BO-sfp",
    objectName: "SFP",
    unit: "generic",
    lastValue: 0,
  }),
];

describe("isAhuAirflowInactive", () => {
  test("null flow og pådrag → inaktiv", () => {
    const model = buildAhuPresentationModel(STOPPED_AHU, { elementKey: "360102" });
    expect(isAhuAirflowInactive(model)).toBe(true);
  });

  test("positiv tilluftsflow → aktiv", () => {
    const signals = STOPPED_AHU.map((entry) =>
      entry.objectName === "AI_SAFFLOW"
        ? { ...entry, lastValue: 420 }
        : entry,
    );
    const model = buildAhuPresentationModel(signals, { elementKey: "360102" });
    expect(isAhuAirflowInactive(model)).toBe(false);
  });
});

describe("resolveSfpStatusDisplayValue", () => {
  test("SFP=0 ved stopp → Stoppet", () => {
    expect(
      resolveSfpStatusDisplayValue({
        rawValue: 0,
        unit: "generic",
        airflowInactive: true,
      }),
    ).toBe("Stoppet");
  });

  test("SFP>0 ved drift → numerisk verdi", () => {
    expect(
      resolveSfpStatusDisplayValue({
        rawValue: 1.8,
        unit: "kilowatts-per-cubic-meter-per-second",
        airflowInactive: false,
      }),
    ).toBe("1.8");
  });
});

describe("prepareAhuSchematicModel SFP", () => {
  test("viser Stoppet i statusstripe når aggregat er stoppet", () => {
    const model = prepareAhuSchematicModel(
      buildAhuPresentationModel(STOPPED_AHU, { elementKey: "360102" }),
      STOPPED_AHU,
    );
    expect(model.statusSlots.find((slot) => slot.slotId === "status.sfp")?.displayValue).toBe(
      "Stoppet",
    );
  });
});
