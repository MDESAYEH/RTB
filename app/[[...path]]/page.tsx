import { clubProvider } from "@/lib/club-repository";
import { notFound, permanentRedirect } from "next/navigation";
import { cookies } from "next/headers";
import { en } from "@/app/i18n-dict";
import { provider, snapshotData } from "@/lib/store";
import Site from "@/app/site";
import { ADMIN_PATH } from "@/lib/admin-path";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    path?: string[];
  }>;
}) {
  const { path: rawPath = [] } = await params;
  const isAdmin = rawPath[0] === ADMIN_PATH;
  // The real admin path never appears in generated metadata (OG image URLs, canonical).
  const path = isAdmin ? ["admin"] : rawPath;
  const english = (await cookies()).get("lang")?.value === "en";
  const tr = (text: string) => (english ? (en[text] ?? text) : text);
  const game =
    path[0] === "matches" && path[1] ? await provider.getGame(path[1]) : null;
  const profile =
    ["team", "teams"].includes(path[0]) && path[1]
      ? await clubProvider.getPublicProfile(path[1])
      : undefined;
  const team =
    ["team", "teams"].includes(path[0]) && path[1]
      ? await provider.getTeam(profile?.id ?? path[1])
      : null;
  const news =
    path[0] === "news"
      ? (await provider.getNews()).find((n) => n.slug === path[1])
      : null;
  const title = profile
    ? `${profile.displayName} | Road to BAL Tripoli 2027`
    : game
      ? ((await provider.getTeam(game.home))?.name ?? "TBD") +
        " vs " +
        ((await provider.getTeam(game.away))?.name ?? "TBD")
      : team?.name ||
        (english && news?.titleEn ? news.titleEn : news?.title) ||
        (
          {
            matches: tr("المباريات"),
            standings: tr("المجموعات"),
            teams: tr("الفرق"),
            stats: tr("الإحصائيات"),
            news: tr("الأخبار"),
            road: "THE ROAD",
            "the-road": "THE ROAD",
            admin: tr("الإدارة"),
            privacy: tr("سياسة الخصوصية"),
            terms: tr("الشروط والأحكام"),
            accessibility: tr("إمكانية الوصول"),
          } as Record<string, string>
          // A plain /admin is not a page any more, so it must not pick up the admin title.
        )[rawPath[0] === "admin" ? "" : path[0]] ||
        tr("طرابلس تستضيف أفريقيا");
  const description =
    (profile?.bioShort && tr(profile.bioShort)) ||
    (english && news?.excerptEn ? news.excerptEn : news?.excerpt) ||
    (game
      ? tr("مركز المباراة") + " · " + game.date + " · GROUP " + game.group
      : "ROAD TO BAL 2027 · TRIPOLI · 21–25 OCTOBER 2026");
  const canonical = profile
    ? "/teams/" + encodeURIComponent(profile.slug)
    : "/" +
      path
        .map((p) => encodeURIComponent(p === "road" ? "the-road" : p))
        .join("/");
  // The OG route looks teams up by id, so resolve slugs/aliases first.
  const image =
    "/api/og?type=" +
    encodeURIComponent(path[0] || "home") +
    "&id=" +
    encodeURIComponent(team?.id ?? path[1] ?? "");
  return {
    description,
    alternates: { canonical },
    robots: isAdmin ? { index: false, follow: false } : undefined,
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
      // Page-level openGraph replaces the layout's, so restate the locale.
      locale: english ? "en_GB" : "ar_LY",
      images: [
        {
          url: image,
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
  params: Promise<{
    path?: string[];
  }>;
}) {
  const { path = [] } = await params;
  const isAdmin = path[0] === ADMIN_PATH;
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
    "privacy",
    "terms",
    "accessibility",
  ];
  if (path.length && !isAdmin && !valid.includes(path[0])) notFound();
  if (
    path.length > 2 ||
    (path.length > 1 &&
      !["matches", "team", "teams", "players", "news"].includes(path[0]))
  )
    notFound();
  if (
    path[0] === "players" &&
    !(
      (await provider.getPlayers()) as {
        id: string;
      }[]
    ).some((p) => p.id === path[1])
  )
    notFound();
  if (path[0] === "matches" && path[1] && !(await provider.getGame(path[1])))
    notFound();
  const profile =
    ["team", "teams"].includes(path[0]) && path[1]
      ? await clubProvider.getPublicProfile(path[1])
      : undefined;
  // Teams created in admin may have no club profile yet; they still get a page.
  const plainTeam =
    path[0] === "teams" && path[1] && !profile
      ? await provider.getTeam(path[1])
      : null;
  if (path[0] === "team" && !profile) notFound();
  if (path[0] === "teams" && path[1] && !profile && !plainTeam) notFound();
  if (path[0] === "team" && profile)
    permanentRedirect("/teams/" + encodeURIComponent(profile.slug));
  const renderPath = isAdmin
    ? ["admin"]
    : profile
    ? ["team", profile.id]
    : plainTeam
      ? ["team", plainTeam.id]
      : path;
  if (
    path[0] === "news" &&
    path[1] &&
    !(await provider.getNews()).some((n) => n.slug === path[1])
  )
    notFound();
  return (
    <Site
      historicalProfile={profile}
      path={renderPath}
      initial={await snapshotData()}
      serverNow={Date.now()}
    />
  );
}
