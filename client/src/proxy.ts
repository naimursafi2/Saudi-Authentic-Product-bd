import { NextResponse } from "next/server";

/**
 * Pass-through only.
 *
 * This proxy used to redirect to /account when no `accessToken` /
 * `refreshToken` cookie was present, as a "no flash of admin shell"
 * optimisation. That check CANNOT work in the deployed setup: the frontend
 * is served from a different origin than the API (…vercel.app vs
 * …onrender.com), so the session cookies are set on the API's domain and are
 * never sent to the frontend's own origin. `request.cookies` here is always
 * empty in production, which made every /admin and /employee request
 * redirect to /account — and, because /account redirects staff back to their
 * portal, that produced an infinite redirect loop and a permanently blank
 * page. It only appeared to work locally because both apps shared the
 * `localhost` cookie jar.
 *
 * Role enforcement is (and always was) done by:
 *   1. The backend API (`authorize(...)` on every route) — the real guard.
 *   2. `RoleGuard` (components/admin/RoleGuard.tsx), which calls
 *      `GET /auth/me` and renders a placeholder until the role is confirmed,
 *      so there is no flash of admin content either.
 *
 * Nothing is lost by not checking here. Do not reintroduce a cookie check in
 * this file unless the API is moved behind the same origin as the frontend.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*"],
};
