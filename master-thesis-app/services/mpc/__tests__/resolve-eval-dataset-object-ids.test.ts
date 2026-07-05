import { describe, expect, test } from "bun:test";
import {
  resolveEvalDatasetObjectIds,
  resolveEvalDatasetSignals,
} from "@/services/mpc/resolve-eval-dataset-object-ids";

const points = [
  { objectId: "AV-30588", objectName: "360102_RT401_SP" },
  { objectId: "AV-40433", objectName: "360102_RT401_SPK" },
  { objectId: "AV-40353", objectName: "360102_JV401_C" },
  { objectId: "AV-40354", objectName: "360102_JV501_C" },
  { objectId: "AV-40372", objectName: "360102_RT550_C" },
  { objectId: "AV-40374", objectName: "AO_5" },
  { objectId: "AV-40294", objectName: "360102_RT501_PV" },
  { objectId: "AV-40292", objectName: "360102_RT401_PV" },
  { objectId: "AV-40325", objectName: "360102_RT402_MV" },
  { objectId: "AV-40326", objectName: "360102_RT901_MV" },
  { objectId: "AV-30589", objectName: "360102_RT501_SP" },
  { objectId: "AV-40373", objectName: "AO_4" },
  { objectId: "AI-2", objectName: "320.001RT901_MV" },
] as const;

describe("resolveEvalDatasetObjectIds", () => {
  test("inkluderer plant-signaler som heat_recovery.after_temp", () => {
    const signals = resolveEvalDatasetSignals([...points]);
    expect(signals.some((row) => row.canonicalId === "heat_recovery.after_temp")).toBe(
      true,
    );
    expect(signals.length).toBeGreaterThanOrEqual(10);
  });

  test("returnerer unike objectIds inkl. kjøle-feedback", () => {
    const objectIds = resolveEvalDatasetObjectIds([...points]);
    expect(objectIds).toContain("AV-40325");
    expect(objectIds).toContain("AV-40373");
    expect(new Set(objectIds).size).toBe(objectIds.length);
  });
});
