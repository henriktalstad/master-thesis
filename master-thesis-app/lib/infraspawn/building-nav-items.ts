export type InfraspawnBuildingNavItem = {
  buildingId: string;
  buildingName: string;
  buildingSlug: string;
  sourceCount: number;
};

export function resolveSoleBuildingSlugFromNavItems(
  navItems: ReadonlyArray<InfraspawnBuildingNavItem>,
): string | null {
  return navItems.length === 1 ? (navItems[0]?.buildingSlug ?? null) : null;
}
