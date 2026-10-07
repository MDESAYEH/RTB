import { NextResponse } from "next/server";
import { provider, list, revision } from "@/lib/store";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      settings: provider.getTournament(),
      teams: provider.getTeams(),
      games: provider.getGames(),
      players: provider.getPlayers(),
      stats: list("stats"),
      events: list("events"),
      teamStats: list("teamStats"),
      news: provider.getNews(),
      pulse: list("pulse"),
      revision: revision(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
