import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEMO_COOKIE = "thesis_demo_access";

function isDemoGateEnabled(): boolean {
  const token = process.env.DEMO_ACCESS_TOKEN?.trim();
  return Boolean(token && token.length >= 8);
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/inngest")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  if (pathname === "/api/health") return true;
  return false;
}

export function proxy(request: NextRequest) {
  if (!isDemoGateEnabled() || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.DEMO_ACCESS_TOKEN!.trim();
  const queryToken = request.nextUrl.searchParams.get("demo");
  const cookieToken = request.cookies.get(DEMO_COOKIE)?.value;
  const authorized = queryToken === expected || cookieToken === expected;

  if (!authorized) {
    return new NextResponse(
      "Tilgang krever ?demo=<token> én gang (live SD-app — ikke offentlig uten token).",
      { status: 401 },
    );
  }

  if (queryToken === expected && cookieToken !== expected) {
    const response = NextResponse.next();
    response.cookies.set(DEMO_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sd-anlegg/:path*"],
};
