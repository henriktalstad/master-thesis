import { describe, expect, it } from "bun:test";
import {
  resolveSoleBuildingSlugFromNavItems,
  type InfraspawnBuildingNavItem,
} from "@/lib/infraspawn/building-nav-items";

const item = (
  slug: string,
  overrides: Partial<InfraspawnBuildingNavItem> = {},
): InfraspawnBuildingNavItem => ({
  buildingId: overrides.buildingId ?? slug,
  buildingName: overrides.buildingName ?? slug,
  buildingSlug: slug,
  sourceCount: overrides.sourceCount ?? 1,
});

describe("resolveSoleBuildingSlugFromNavItems", () => {
  it("returns slug when exactly one navigable building exists", () => {
    expect(resolveSoleBuildingSlugFromNavItems([item("alpha")])).toBe("alpha");
  });

  it("returns null for zero or multiple buildings", () => {
    expect(resolveSoleBuildingSlugFromNavItems([])).toBeNull();
    expect(
      resolveSoleBuildingSlugFromNavItems([item("alpha"), item("beta")]),
    ).toBeNull();
  });
});
