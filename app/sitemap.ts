import type { MetadataRoute } from "next";
import { provider } from "@/lib/store";
import { clubProvider } from "@/lib/club-repository";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [
    "",
    "/matches",
    "/standings",
    "/teams",
    "/stats",
    "/news",
    "/the-road",
    "/privacy",
    "/terms",
    "/accessibility",
    // Team pages are canonical at the club profile slug when one exists.
    ...(await Promise.all(
      (await provider.getTeams()).map(
        async (t) =>
          "/teams/" +
          encodeURIComponent(
            (await clubProvider.getPublicProfile(t.id))?.slug ?? t.id,
          ),
      ),
    )),
    ...(await provider.getGames()).map((g) => "/matches/" + g.id),
    ...(await provider.getNews()).map((n) => "/news/" + n.slug),
  ];
  return paths.map((path) => ({
    url: new URL(path || "/", process.env.SITE_URL || "http://localhost:3000")
      .href,
  }));
}
