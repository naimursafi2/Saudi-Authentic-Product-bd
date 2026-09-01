import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
