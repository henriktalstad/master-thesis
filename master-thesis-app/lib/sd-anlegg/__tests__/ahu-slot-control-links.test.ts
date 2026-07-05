import { describe, expect, test } from "bun:test";
import {
  resolveAhuSlotStyringHref,
  resolveAhuSlotStyringLink,
} from "@/lib/sd-anlegg/ahu-slot-control-links";

describe("ahu-slot-control-links", () => {
  test("MPC-slots har styring-lenke", () => {
    expect(resolveAhuSlotStyringLink("supply.fan")?.canonicalId).toBe(
      "supply.fan.command",
    );
    expect(resolveAhuSlotStyringLink("heating.valve")?.tab).toBe("analyse");
    expect(resolveAhuSlotStyringLink("status.system")?.tab).toBe("oppsett");
  });

  test("diagnostiske slots uten MPC-kobling returnerer null", () => {
    expect(resolveAhuSlotStyringLink("status.sfp")).toBeNull();
    expect(resolveAhuSlotStyringLink("supply.filter")).toBeNull();
  });

  test("bygger href med riktig fane", () => {
    expect(
      resolveAhuSlotStyringHref("sorgenfriveien-32ab", "exhaust.temp"),
    ).toEqual({
      href: "/sd-anlegg/sorgenfriveien-32ab/styring?vis=analyse&visning=signaler",
      label: "Avtrekk (komfort)",
      tab: "analyse",
    });
  });
});
