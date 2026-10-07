import { db } from "./store";
import {
  clubProfiles,
  clubProfileSchema,
  publicClubProfile,
  type ClubProfile,
} from "./club-profile";
// Independent historical records. No writes to games, teams, stats, revision or qualification.
let initialized = false;
function initialize() {
  if (initialized) return;
  db.exec(
    "CREATE TABLE IF NOT EXISTS club_profiles(id TEXT PRIMARY KEY,body TEXT NOT NULL CHECK(json_valid(body)))",
  );
  db.transaction(() => {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO club_profiles(id,body) VALUES(?,?)",
    );
    for (const p of clubProfiles) insert.run(p.id, JSON.stringify(p));
  })();
  initialized = true;
}
export class ManualClubDataProvider {
  getProfile(idOrSlug: string): ClubProfile | undefined {
    initialize();
    const match = clubProfiles.find(
      (p) =>
        p.id === idOrSlug ||
        p.slug === idOrSlug ||
        p.aliases.includes(idOrSlug),
    );
    if (!match) return;
    const row = db
      .prepare("SELECT body FROM club_profiles WHERE id=?")
      .get(match.id) as { body: string } | undefined;
    return clubProfileSchema.parse(row ? JSON.parse(row.body) : match);
  }
  getPublicProfile(idOrSlug: string) {
    const p = this.getProfile(idOrSlug);
    return p ? publicClubProfile(p) : undefined;
  }
}
export const clubProvider = new ManualClubDataProvider();
