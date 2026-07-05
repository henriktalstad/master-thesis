import { describe, expect, test } from "bun:test";
import {
  resolveTrustedCoolingValvePct,
} from "@/lib/sd-anlegg/control/resolve-cooling-valve-pct";

describe("resolveTrustedCoolingValvePct", () => {
  test("beholder modulert pådrag under metning", () => {
    expect(
      resolveTrustedCoolingValvePct({ commandPct: 37.2, feedbackPct: 11.6 }),
    ).toEqual({
      trustedPct: 37.2,
      source: "command",
      rawCommandPct: 37.2,
      feedbackPct: 11.6,
    });
  });

  test("bruker feedback når pådrag er mettet og utetemp OK", () => {
    expect(
      resolveTrustedCoolingValvePct({
        commandPct: 100,
        feedbackPct: 3.4,
        outdoorTempC: 18,
      }),
    ).toEqual({
      trustedPct: 3.4,
      source: "feedback",
      rawCommandPct: 100,
      feedbackPct: 3.4,
    });
  });

  test("ignorerer feedback ved mettet pådrag og lav utetemp", () => {
    expect(
      resolveTrustedCoolingValvePct({
        commandPct: 100,
        feedbackPct: 26,
        outdoorTempC: 12.8,
      }),
    ).toMatchObject({ trustedPct: 0, source: "zero_no_cooling_context" });
  });

  test("nuller mettet pådrag uten feedback ved lav utetemp", () => {
    expect(
      resolveTrustedCoolingValvePct({
        commandPct: 100,
        outdoorTempC: 14,
      }),
    ).toEqual({
      trustedPct: 0,
      source: "zero_no_cooling_context",
      rawCommandPct: 100,
      feedbackPct: null,
    });
  });

  test("nuller mettet pådrag uten feedback og utetemp", () => {
    expect(
      resolveTrustedCoolingValvePct({ commandPct: 100 }),
    ).toMatchObject({ trustedPct: 0, source: "zero_saturated" });
  });
});
