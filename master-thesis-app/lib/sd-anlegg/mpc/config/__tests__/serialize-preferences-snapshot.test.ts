import { describe, expect, it } from "bun:test";
import { NAERBYEN_OFFICE_COMFORT_SCHEDULE } from "@/lib/sd-anlegg/mpc/config/comfort-schedule";
import { NAERBYEN_OFFICE_OPERATING_PROFILE } from "@/lib/sd-anlegg/mpc/config/resolve-occupancy";
import {
  serializeMpcPreferencesSnapshot,
  resolveMpcBuildingPreferences,
} from "@/lib/sd-anlegg/mpc/config/resolve-preferences";

describe("serializeMpcPreferencesSnapshot", () => {
  it("serialiserer preset og kanaler for pipeline-run", () => {
    const prefs = resolveMpcBuildingPreferences({
      buildingSlug: "sorgenfriveien-32ab",
    });
    expect(prefs).not.toBeNull();

    const snapshot = serializeMpcPreferencesSnapshot(prefs!);

    expect(snapshot.buildingSlug).toBe("sorgenfriveien-32ab");
    expect(snapshot.tuningPresetId).toBe("anlegg_pris_respons_v1");
    expect(snapshot.comfortSchedule).toEqual(NAERBYEN_OFFICE_COMFORT_SCHEDULE);
    expect(snapshot.operatingProfile).toEqual(NAERBYEN_OFFICE_OPERATING_PROFILE);
    expect(snapshot.channels.length).toBeGreaterThan(0);
    expect(snapshot.mpcChannelEnabled.supplyFanPct).toBe(true);
  });
});
