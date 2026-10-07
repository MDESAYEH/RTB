import { get, write, db } from "../lib/store";
import type { Team } from "../lib/domain";
const team = get<Team>("teams", "stade-malien");
if (team?.name === "Stade Malien" && !team.verified)
  write(
    "teams",
    team.id,
    { ...team, verified: true },
    "source-review:FIBA-fr-2026-10-05",
  );
console.log(
  JSON.stringify({
    integrity: db.prepare("PRAGMA integrity_check").get(),
    foreignKeys: db.prepare("PRAGMA foreign_key_check").all(),
    busyTimeout: db.prepare("PRAGMA busy_timeout").get(),
    stadeVerified: get<Team>("teams", "stade-malien")?.verified,
    admins: db.prepare("SELECT count(*) AS n FROM admins").get(),
  }),
);
db.close();
