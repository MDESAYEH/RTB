import { db } from "./store";
import {
  clubProfiles,
  clubProfileSchema,
  publicClubProfile,
  type ClubProfile,
} from "./club-profile";
// Independent historical records. No writes to games, teams, stats, revision or qualification.
let initialized = false;
async function initialize() {
  if (initialized) return;
  if (process.env.TURSO_DATABASE_URL) {
    initialized = true;
    return;
  }
  await db.exec(
    "CREATE TABLE IF NOT EXISTS club_profiles(id TEXT PRIMARY KEY,body TEXT NOT NULL CHECK(json_valid(body)))",
  );
  await db.transaction(async () => {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO club_profiles(id,body) VALUES(?,?)",
    );
    for (const p of clubProfiles) await insert.run(p.id, JSON.stringify(p));
  })();
  initialized = true;
}
export class ManualClubDataProvider {
  async getProfile(idOrSlug: string): Promise<ClubProfile | undefined> {
    await initialize();
    const match = clubProfiles.find(
      (p) =>
        p.id === idOrSlug ||
        p.slug === idOrSlug ||
        p.aliases.includes(idOrSlug),
    );
    if (!match) return;
    const row = (await db
      .prepare("SELECT body FROM club_profiles WHERE id=?")
      .get(match.id)) as
      | {
          body: string;
        }
      | undefined;
    return clubProfileSchema.parse(row ? JSON.parse(row.body) : match);
  }
  async getPublicProfile(idOrSlug: string) {
    const p = await this.getProfile(idOrSlug);
    return p ? publicClubProfile(p) : undefined;
  }
}
export const clubProvider = new ManualClubDataProvider();
