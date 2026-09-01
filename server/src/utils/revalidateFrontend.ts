import { env, isRevalidateConfigured, clientOrigins } from "../config/env";

/**
 * Tells the Next.js frontend to drop its cached copy of `tag` right now, so
 * an admin's change (nav link, category, homepage section, site settings)
 * is visible to visitors on their very next page load instead of waiting
 * out the frontend's long safety-net cache window (see the client's
 * `(site)/layout.tsx` / `(site)/page.tsx` / `(site)/shop/page.tsx`).
 *
 * Fire-and-forget by design: never throws, never blocks or fails the admin
 * action that triggered it. If `REVALIDATE_SECRET` isn't configured yet, or
 * the frontend can't be reached, this silently no-ops — same
 * graceful-degrade pattern as Cloudinary/SMTP/SMS/bKash (see config/env.ts).
 * Worst case the change just waits out that safety-net window instead of
 * showing up instantly, nothing breaks.
 *
 * Reuses `CLIENT_ORIGIN` (already configured for CORS) as the frontend's
 * address rather than a second env var — if more than one origin is listed
 * (e.g. a preview URL alongside production), only the first is called.
 */
export function revalidateFrontendTag(tag: string): void {
  if (!isRevalidateConfigured || clientOrigins.length === 0) return;

  fetch(`${clientOrigins[0]}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": env.REVALIDATE_SECRET,
    },
    body: JSON.stringify({ tags: [tag] }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Best-effort only — see doc comment above.
  });
}
