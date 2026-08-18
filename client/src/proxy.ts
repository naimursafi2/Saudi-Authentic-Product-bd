import { NextResponse, type NextRequest } from "next/server";

/**
 * Defense-in-depth only: redirects immediately (before any React renders)
 * when there's no session cookie at all, so an unauthenticated visitor
 * never sees a flash of the admin/employee shell before client-side
 * `RoleGuard` (in components/admin/RoleGuard.tsx) kicks in.
 *
 * This proxy CANNOT verify the user's role — the JWT signing secret lives
 * only on the backend, and decoding it here would require shipping that
 * secret to the edge runtime, which must never happen. Role enforcement is
 * (and must remain) done by:
 *   1. The backend API (`authorize(...)` on every route) — the real guard.
 *   2. `RoleGuard`, which calls `GET /auth/me` and redirects client-side.
 * This proxy only handles the "no cookie at all" case.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("accessToken") || request.cookies.has("refreshToken");

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*"],
};
