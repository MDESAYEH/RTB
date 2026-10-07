import { get, write, db } from "../lib/store";
import type { Team } from "../lib/domain";
const team = await get<Team>("teams", "stade-malien");
if (team?.name === "Stade Malien" && !team.verified)
  await write(
    "teams",
    team.id,
    { ...team, verified: true },
    "source-review:FIBA-fr-2026-10-05",
  );
console.log(
  JSON.stringify({
    integrity: await db.prepare("PRAGMA integrity_check").get(),
    foreignKeys: await db.prepare("PRAGMA foreign_key_check").all(),
    busyTimeout: await db.prepare("PRAGMA busy_timeout").get(),
    stadeVerified: (await get<Team>("teams", "stade-malien"))?.verified,
    admins: await db.prepare("SELECT count(*) AS n FROM admins").get(),
  }),
);
await db.close();
