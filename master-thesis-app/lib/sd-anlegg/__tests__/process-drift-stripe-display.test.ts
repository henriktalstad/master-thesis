import { describe, expect, test } from "bun:test";
import {
  driftStripeValueToneClass,
  resolveDriftStripeValueTone,
} from "@/lib/sd-anlegg/process-drift-stripe-display";

describe("resolveDriftStripeValueTone", () => {
  test("system stoppet er warning", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.system",
        displayValue: "Stoppet",
      }),
    ).toBe("warning");
  });

  test("frost normal er success", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.frost",
        displayValue: "Normal",
      }),
    ).toBe("success");
  });

  test("settpunkt er primary", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.setpoint",
        displayValue: "18,07 °C",
      }),
    ).toBe("primary");
  });

  test("SFP stoppet er muted", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.sfp",
        displayValue: "Stoppet",
      }),
    ).toBe("muted");
  });

  test("alarm på stoppet er warning, ikke destructive", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.system",
        displayValue: "Stoppet",
        alarm: true,
      }),
    ).toBe("warning");
  });

  test("alarm overstyrer kjørende til destructive", () => {
    expect(
      resolveDriftStripeValueTone({
        slotId: "status.frost",
        displayValue: "Normal",
        alarm: true,
      }),
    ).toBe("destructive");
  });

  test("driftStripeValueToneClass mapper til tailwind", () => {
    expect(driftStripeValueToneClass("primary")).toBe("text-primary");
    expect(driftStripeValueToneClass("success")).toBe("text-success");
  });
});
