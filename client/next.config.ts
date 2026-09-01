import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client Router Cache: how long (seconds) a page you've already visited
    // stays in the BROWSER's own memory this session, so going back to it
    // (Home -> Shop -> About -> Home ...) serves instantly with zero network
    // request — no RSC fetch to the server at all, not even a cache hit on
    // the server, nothing shows up in the Network tab. Next.js 15+ ships
    // this at 0 (off) by default, which is why every single navigation was
    // triggering a fresh request even though the *data* behind it was
    // already being cached server-side (see homepageSections.ts/(site)
    // layout.tsx for that separate fix).
    //
    // 24h here is effectively "for the whole visit" — nobody keeps a tab
    // open that long — while still self-healing on its own if it ever
    // needed to. It's not what makes an admin's save show up though: that's
    // the "categories"/"nav-links"/"site-settings"/"homepage-sections" tags
    // (see lib/api/client.ts) — an admin save busts the SERVER's Data Cache
    // instantly via `/api/revalidate`, so a visitor's next fresh page load
    // (or a currently-open tab once this Router Cache entry does expire)
    // always gets the new data regardless of this number. `static`
    // (prefetched links, e.g. hovered/in-viewport <Link>s) must stay
    // >= 30s per Next.js's own constraint — 180s is already generous there.
    staleTimes: {
      dynamic: 60 * 60 * 24,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Google "Continue with Google" profile pictures (auth.service.ts's
      // googleAuth() stores the hotlinked URL as-is, never re-uploads it to
      // Cloudinary) — served from lh3/lh4/lh5/... .googleusercontent.com,
      // hence the wildcard rather than one fixed subdomain.
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
