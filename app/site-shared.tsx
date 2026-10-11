// Pieces shared by the public site and the lazily loaded admin panel.
import { CalendarDays } from "lucide-react";
import type { Settings, Team, Game, News } from "@/lib/public-domain";
export type Data = {
  settings: Settings;
  teams: Team[];
  games: Game[];
  news: News[];
  players: unknown[];
  stats: unknown[];
  events: {
    id: string;
    game: string;
    period: number;
    clock: string;
    text: string;
    textEn?: string;
  }[];
  teamStats: Record<string, string | number>[];
  pulse: {
    id: string;
    text: string;
    textEn?: string;
    date: string;
    type?: string;
    game?: string;
    team?: string;
  }[];
  revision: number;
};
export const statusLabel: Record<string, string> = {
  Scheduled: "قادمة",
  Warmup: "الإحماء",
  Live: "مباشر",
  Halftime: "استراحة",
  Ended: "انتهت",
  Postponed: "مؤجلة",
  Cancelled: "ملغاة",
};
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
