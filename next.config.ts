import type { NextConfig } from "next";
import registry from "./lib/team-identity.json";
import { securityPolicy } from "./lib/security-policy";
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
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
          {
            key: "Content-Security-Policy",
            value: securityPolicy(undefined, process.env.NODE_ENV === "development"),
          },
        ],
      },
      // Admin responses carry session-scoped data: never cache them.
      { source: "/api/admin", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};
export default config;
