import type { MetadataRoute } from "next";
import { provider } from "@/lib/store";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/matches",
    "/standings",
    "/teams",
    "/stats",
    "/news",
    "/the-road",
    ...provider.getTeams().map((t) => "/teams/" + t.id),
    ...provider.getGames().map((g) => "/matches/" + g.id),
    ...provider.getNews().map((n) => "/news/" + n.slug),
  ];
  return paths.map((path) => ({
    url: new URL(path || "/", process.env.SITE_URL || "http://localhost:3000")
      .href,
  }));
}
