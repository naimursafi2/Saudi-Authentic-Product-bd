import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * On-demand cache revalidation. Called by the Express backend right after an
 * admin saves a nav link / category / homepage section / site setting (see
 * `server/src/utils/revalidateFrontend.ts` for the caller) — busts the named
 * Data Cache tag(s) immediately, instead of visitors waiting out the long
 * safety-net `revalidate` window in `(site)/layout.tsx` / `(site)/page.tsx`
 * / `(site)/shop/page.tsx`. This is what makes "cache held (almost)
 * permanently" and "admin changes show up instantly" both true at once.
 *
 * Gated by a shared secret rather than admin auth — the caller here is the
 * Express backend itself (a server-to-server call), not a logged-in
 * browser, so there's no session/cookie to check. Both sides read the same
 * `REVALIDATE_SECRET` value from their own env vars; set it on Vercel
 * (this app) and on Render (the backend) to the same random string.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { message: "REVALIDATE_SECRET is not configured on the frontend" },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-revalidate-secret");
  if (provided !== expected) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const tags = (body as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t) => typeof t === "string")) {
    return NextResponse.json(
      { message: "`tags` must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  // `{ expire: 0 }` (not the `"max"` profile Next.js recommends for most
  // cases) — that profile would let the very next request after a save
  // still be served stale content while a background refresh runs, which
  // isn't "the admin's change shows up immediately." `expire: 0` makes the
  // very next request for this tag block on a fresh fetch instead.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: true, tags, now: Date.now() });
}
