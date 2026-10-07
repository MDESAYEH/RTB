import { clubProvider } from "@/lib/club-repository";
import { notFound, permanentRedirect } from "next/navigation";
import { provider, list, revision } from "@/lib/store";
import Site from "@/app/site";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const game =
    path[0] === "matches" && path[1] ? provider.getGame(path[1]) : null;
  const profile =
    ["team", "teams"].includes(path[0]) && path[1]
      ? clubProvider.getPublicProfile(path[1])
      : undefined;
  const team = profile ? provider.getTeam(profile.id) : null;
  const news =
    path[0] === "news"
      ? provider.getNews().find((n) => n.slug === path[1])
      : null;
  const title = profile
    ? `${profile.displayName} | Road to BAL Tripoli 2027`
    : game
      ? provider.getTeam(game.home)?.name +
        " vs " +
        provider.getTeam(game.away)?.name
      : team?.name ||
        news?.title ||
        (
          {
            matches: "المباريات",
            standings: "المجموعات",
            teams: "الفرق",
            stats: "الإحصائيات",
            news: "الأخبار",
            road: "THE ROAD",
            "the-road": "THE ROAD",
            admin: "الإدارة",
          } as Record<string, string>
        )[path[0]] ||
        "طرابلس تستضيف أفريقيا";
  const description =
    profile?.bioShort ||
    news?.excerpt ||
    (game
      ? "مركز المباراة · " + game.date + " · GROUP " + game.group
      : "ROAD TO BAL 2027 · TRIPOLI · 21–25 OCTOBER 2026");
  const canonical = profile
    ? "/teams/" + encodeURIComponent(profile.slug)
    : "/" +
      path
        .map((p) => encodeURIComponent(p === "road" ? "the-road" : p))
        .join("/");
  const image =
    "/api/og?type=" +
    encodeURIComponent(path[0] || "home") +
    "&id=" +
    encodeURIComponent(path[1] || "");
  return {
    description,
    alternates: { canonical },
    robots: path[0] === "admin" ? { index: false, follow: false } : undefined,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: news ? "article" : "website",
      images: [
        {
          url:
            "/api/og?type=" +
            encodeURIComponent(path[0] || "home") +
            "&id=" +
            encodeURIComponent(path[1] || ""),
          width: 1200,
          height: 630,
          alt: "Road to BAL 2027 · Tripoli",
        },
      ],
    },
    title: profile ? { absolute: title } : title,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const valid = [
    "matches",
    "standings",
    "teams",
    "team",
    "players",
    "stats",
    "news",
    "road",
    "the-road",
    "admin",
  ];
  if (path.length && !valid.includes(path[0])) notFound();
  if (
    path.length > 2 ||
    (path.length > 1 &&
      !["matches", "team", "teams", "players", "news"].includes(path[0]))
  )
    notFound();
  if (
    path[0] === "players" &&
    !(provider.getPlayers() as { id: string }[]).some((p) => p.id === path[1])
  )
    notFound();
  if (path[0] === "matches" && path[1] && !provider.getGame(path[1]))
    notFound();
  const profile =
    ["team", "teams"].includes(path[0]) && path[1]
      ? clubProvider.getPublicProfile(path[1])
      : undefined;
  if ((path[0] === "team" || (path[0] === "teams" && path[1])) && !profile)
    notFound();
  if (path[0] === "team" && profile)
    permanentRedirect("/teams/" + encodeURIComponent(profile.slug));
  const renderPath = profile ? ["team", profile.id] : path;
  if (
    path[0] === "news" &&
    path[1] &&
    !provider.getNews().some((n) => n.slug === path[1])
  )
    notFound();
  return (
    <Site
      historicalProfile={profile}
      path={renderPath}
      initial={{
        settings: provider.getTournament(),
        teams: provider.getTeams(),
        games: provider.getGames(),
        news: provider.getNews(),
        players: provider.getPlayers(),
        stats: list("stats"),
        events: list("events"),
        teamStats: list("teamStats"),
        pulse: list("pulse"),
        revision: revision(),
      }}
    />
  );
}
