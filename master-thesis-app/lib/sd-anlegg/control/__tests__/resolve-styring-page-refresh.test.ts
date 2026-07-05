import { describe, expect, test } from "bun:test";
import { shouldRunStyringPageRefresh } from "@/lib/sd-anlegg/control/resolve-styring-page-refresh";

describe("shouldRunStyringPageRefresh", () => {
  test("full refresh kun på Effekt og Oppsett", () => {
    expect(
      shouldRunStyringPageRefresh({ refreshKind: "full", activeTab: "na" }),
    ).toBe(false);
    expect(
      shouldRunStyringPageRefresh({ refreshKind: "full", activeTab: "analyse" }),
    ).toBe(true);
    expect(
      shouldRunStyringPageRefresh({ refreshKind: "full", activeTab: "oppsett" }),
    ).toBe(true);
  });

  test("live og none trigger ikke page refresh", () => {
    expect(
      shouldRunStyringPageRefresh({ refreshKind: "live", activeTab: "analyse" }),
    ).toBe(false);
    expect(
      shouldRunStyringPageRefresh({ refreshKind: "none", activeTab: "oppsett" }),
    ).toBe(false);
  });
});
