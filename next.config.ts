import type { NextConfig } from "next";
import registry from "./lib/team-identity.json";
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return registry.teams.map((t) => ({
      source: "/team/" + t.id,
      destination: "/teams/" + t.slug,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://assets.fiba.basketball; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com; font-src 'self'; frame-src https://*.facebook.com https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'${process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : ""}`,
          },
        ],
      },
      // Admin responses carry session-scoped data: never cache them.
      { source: "/api/admin", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};
export default config;
