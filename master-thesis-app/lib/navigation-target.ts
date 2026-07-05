type DashboardRoute = "/oversikt" | "/eos";

export function normalizePathname(pathname: string): string {
  const t = pathname.replace(/\/+$/, "");
  return t === "" ? "/" : t;
}

function targetPathFromHref(href: string): string {
  const raw = href.split("?")[0]?.split("#")[0] ?? href;
  return normalizePathname(raw);
}

export function isDashboardRoute(pathname: string): pathname is DashboardRoute {
  const p = normalizePathname(pathname);
  return p === "/oversikt" || p === "/eos";
}

export function pathnameMatchesNavigationTarget(
  pathname: string,
  targetHref: string,
): boolean {
  const targetPath = targetPathFromHref(targetHref);
  const path = normalizePathname(pathname);

  if (path === targetPath) return true;
  if (targetPath === "/admin" || targetPath === "/eos") {
    return path === targetPath;
  }
  return path.startsWith(`${targetPath}/`);
}

export function pathnameMatchesNavItem(
  pathname: string,
  navItemUrl: string,
): boolean {
  if (!navItemUrl || navItemUrl === "#") return false;
  if (navItemUrl === "/innstillinger/profil") {
    const path = normalizePathname(pathname);
    return path === "/innstillinger" || path.startsWith("/innstillinger/");
  }
  return pathnameMatchesNavigationTarget(pathname, navItemUrl);
}

export function isNavigationTargetCurrentPage(
  pathname: string,
  targetHref: string,
): boolean {
  if (!targetHref || targetHref.startsWith("#")) return false;
  if (targetHref.startsWith("http://") || targetHref.startsWith("https://")) {
    return false;
  }

  const targetPath = targetPathFromHref(targetHref);
  const path = normalizePathname(pathname);

  if (targetPath === "/sd-anlegg") {
    return path === "/sd-anlegg";
  }

  return pathnameMatchesNavigationTarget(pathname, targetHref);
}

export function navigationHrefMatchesPending(
  pendingHref: string | null | undefined,
  linkHref: string,
): boolean {
  if (!pendingHref) return false;
  if (pendingHref === linkHref) return true;

  const pendingPath = pendingHref.split("?")[0]?.split("#")[0] ?? "";
  const linkPath = linkHref.split("?")[0]?.split("#")[0] ?? "";
  if (!pendingPath || pendingPath !== linkPath) return false;

  return isDashboardRoute(pendingPath);
}
