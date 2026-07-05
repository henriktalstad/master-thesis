import { describe, expect, it } from "bun:test";
import { buildInfraspawnPointDisplayMapping } from "../build-infraspawn-point-display-mapping";
import type { InfraspawnPointListItem } from "../types";

function point(
  overrides: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectId">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "360.102 Næringsdel blokk B",
    objectName: overrides.objectId,
    description: null,
    unit: "°C",
    lastValue: 30,
    lastSampledAt: "2024-06-18T07:51:00.000Z",
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...overrides,
  };
}

describe("buildInfraspawnPointDisplayMapping", () => {
  it("bygger auto-overrides fra description", () => {
    const mapping = buildInfraspawnPointDisplayMapping({
      points: [
        point({
          objectId: "362.001RT601_MV",
          description: "Romtemperatur heissjakt bygg B",
        }),
      ],
    });

    expect(mapping.pointDisplayOverrides).toEqual([
      {
        sourceId: "src-1",
        objectId: "362.001RT601_MV",
        label: "Heissjakt bygg B",
      },
    ]);
  });

  it("prioriterer manuelle overrides", () => {
    const mapping = buildInfraspawnPointDisplayMapping({
      points: [
        point({
          objectId: "362.001RT601_MV",
          description: "Romtemperatur heissjakt",
        }),
      ],
      manualOverrides: [
        {
          sourceId: "src-1",
          objectId: "362.001RT601_MV",
          label: "Egen etikett",
        },
      ],
    });

    expect(mapping.pointDisplayOverrides[0]?.label).toBe("Egen etikett");
  });

  it("velger auto-featured fra punkt i alarm med lokasjon", () => {
    const mapping = buildInfraspawnPointDisplayMapping({
      points: [
        point({
          objectId: "362.001RT601_MV",
          description: "Heissjakt bygg B",
          statusInAlarm: true,
        }),
      ],
    });

    expect(mapping.featuredPointRefs[0]).toMatchObject({
      objectId: "362.001RT601_MV",
      label: "Heissjakt bygg B",
    });
  });
});
