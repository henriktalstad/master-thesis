import { describe, expect, test } from "bun:test";
import {
  infraspawnPointHaystack,
  resolveFdvDescriptionAliasTokens,
} from "@/lib/infraspawn/point-haystack";

describe("resolveFdvDescriptionAliasTokens", () => {
  test("gjenkjenner Temp. tilluft", () => {
    expect(resolveFdvDescriptionAliasTokens("Temp. tilluft")).toContain("RT401");
    expect(resolveFdvDescriptionAliasTokens("Temp. tilluft")).toContain("supply");
  });

  test("gjenkjenner frostvakt", () => {
    expect(resolveFdvDescriptionAliasTokens("Frostvakt")).toContain("frostvakt");
  });
});

describe("infraspawnPointHaystack", () => {
  test("inkluderer FDV-alias-tokens i haystack", () => {
    const haystack = infraspawnPointHaystack({
      objectId: "analogInput:1",
      objectName: "AI_SupplyAirTemp",
      description: "Temp. tilluft",
    });

    expect(haystack).toContain("rt401");
    expect(haystack).toContain("tilluft");
  });
});
