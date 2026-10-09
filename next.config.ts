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
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com; font-src 'self'; frame-src https://*.facebook.com https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
