import { describe, expect, test } from "bun:test";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import {
  buildSignalOnboardingReviewQueue,
  mergePointMetadataWithSuggestions,
  suggestPointMetadataOverride,
} from "@/lib/sd-anlegg/signal-onboarding-suggestions";

function point(
  partial: Partial<InfraspawnPointListItem> & Pick<InfraspawnPointListItem, "objectId">,
): InfraspawnPointListItem {
  return {
    sourceId: "src-1",
    sourceLabel: "360.102",
    objectName: null,
    description: null,
    unit: null,
    lastValue: 22,
    lastSampledAt: null,
    quality: "ok",
    statusFault: false,
    statusInAlarm: false,
    statusOutOfService: false,
    statusOverridden: false,
    ...partial,
  };
}

describe("suggestPointMetadataOverride", () => {
  test("foreslår utstyrstag og FDV-beskrivelse for AI_SupplyAirTemp", () => {
    const suggestions = suggestPointMetadataOverride({
      point: point({
        objectId: "AV-6",
        objectName: "AI_SupplyAirTemp",
      }),
      elementKey: "360102",
    });

    expect(suggestions.schemaSlotId?.value).toBe("supply.temp_out");
    expect(suggestions.objectName?.value).toBe("360102_RT401_PV");
    expect(suggestions.description?.value).toBe("Temp. tilluft");
    expect(suggestions.scopeId?.value).toBe("src-1:360102");
  });

  test("foreslår ikke utstyrstag når tag allerede er kompakt", () => {
    const suggestions = suggestPointMetadataOverride({
      point: point({
        objectId: "AV-6",
        objectName: "360102_RT401_PV",
        description: "Temp. tilluft",
      }),
      elementKey: "360102",
    });

    expect(suggestions.objectName).toBeUndefined();
    expect(suggestions.description).toBeUndefined();
  });
});

describe("mergePointMetadataWithSuggestions", () => {
  test("autofyller tomme felt fra forslag", () => {
    const reviewPoint = point({
      objectId: "AV-6",
      objectName: "AI_SupplyAirTemp",
    });
    const merged = mergePointMetadataWithSuggestions({
      point: reviewPoint,
      suggestions: suggestPointMetadataOverride({
        point: reviewPoint,
        elementKey: "360102",
      }),
    });

    expect(merged.objectName).toBe("AI_SupplyAirTemp");
    expect(merged.description).toBe("Temp. tilluft");
    expect(merged.schemaSlotId).toBe("supply.temp_out");
    expect(merged.scopeId).toBe("src-1:360102");
  });

  test("bevarer speilet når det finnes", () => {
    const merged = mergePointMetadataWithSuggestions({
      point: point({
        objectId: "AV-6",
        objectName: "AI_SupplyAirTemp",
        description: "Egen beskrivelse",
      }),
      suggestions: suggestPointMetadataOverride({
        point: point({
          objectId: "AV-6",
          objectName: "AI_SupplyAirTemp",
          description: "Egen beskrivelse",
        }),
        elementKey: "360102",
      }),
    });

    expect(merged.description).toBe("Egen beskrivelse");
    expect(merged.objectName).toBe("AI_SupplyAirTemp");
  });

  test("preferSuggestions overstyrer flatt speilnavn", () => {
    const reviewPoint = point({
      objectId: "AV-6",
      objectName: "AI_SupplyAirTemp",
    });
    const suggestions = suggestPointMetadataOverride({
      point: reviewPoint,
      elementKey: "360102",
    });
    const merged = mergePointMetadataWithSuggestions({
      point: reviewPoint,
      suggestions,
      preferSuggestions: true,
    });

    expect(merged.objectName).toBe("360102_RT401_PV");
    expect(merged.description).toBe("Temp. tilluft");
  });
});

describe("buildSignalOnboardingReviewQueue", () => {
  test("prioriterer flate BACnet-navn mot manglende slotter", () => {
    const queue = buildSignalOnboardingReviewQueue({
      points: [
        point({
          objectId: "AV-6",
          objectName: "AI_SupplyAirTemp",
        }),
      ],
      elementKey: "360102",
    });

    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0]?.point.objectId).toBe("AV-6");
    expect(queue[0]?.suggestedSlotId).toBe("supply.temp_out");
  });
});
