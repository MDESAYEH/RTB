import { LocalDatabase } from "./database";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  eventSchema,
  teamStatSchema,
  standings,
  gameSchema,
  settingsSchema,
  teamSchema,
  newsSchema,
  playerSchema,
  statSchema,
  pulseSchema,
  type Game,
  type Settings,
  type Team,
  type News,
} from "./domain";
const path = resolve(
  /* turbopackIgnore: true */ process.env.DATABASE_PATH || "data/road.db",
);
mkdirSync(dirname(path), { recursive: true });
export const db = new LocalDatabase(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(
  `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL CHECK(json_valid(body)),PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS records_kind ON records(kind);CREATE UNIQUE INDEX IF NOT EXISTS news_slug ON records(json_extract(body,'$.slug')) WHERE kind='news';CREATE UNIQUE INDEX IF NOT EXISTS stat_identity ON records(json_extract(body,'$.game'),json_extract(body,'$.player')) WHERE kind='stats';CREATE UNIQUE INDEX IF NOT EXISTS team_stat_identity ON records(json_extract(body,'$.game'),json_extract(body,'$.team')) WHERE kind='teamStats';CREATE TABLE IF NOT EXISTS entity_refs(owner_kind TEXT NOT NULL,owner_id TEXT NOT NULL,field TEXT NOT NULL,target_kind TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(owner_kind,owner_id,field),FOREIGN KEY(owner_kind,owner_id) REFERENCES records(kind,id) ON DELETE CASCADE,FOREIGN KEY(target_kind,target_id) REFERENCES records(kind,id));CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY,salt TEXT NOT NULL,hash TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,admin TEXT NOT NULL REFERENCES admins(id),expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,old TEXT,new TEXT,time TEXT NOT NULL);CREATE INDEX IF NOT EXISTS audit_target ON audit(target,id);CREATE TABLE IF NOT EXISTS undo(id INTEGER PRIMARY KEY,game TEXT NOT NULL,body TEXT NOT NULL);CREATE TABLE IF NOT EXISTS revision(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL);INSERT OR IGNORE INTO revision VALUES(1,0);CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`,
);
// Versioned, additive migration: existing records and audit history are retained.
if (
  (db.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version < 2
) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(audit)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "reason"))
      db.exec("ALTER TABLE audit ADD COLUMN reason TEXT");
    db.exec(
      "CREATE TABLE IF NOT EXISTS commands(actor TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,time INTEGER NOT NULL,PRIMARY KEY(actor,id)); PRAGMA user_version=2",
    );
  })();
}
if (
  (db.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version < 3
) {
  db.transaction(() => {
    db.exec("ALTER TABLE audit ADD COLUMN action TEXT; PRAGMA user_version=3");
  })();
}
export function list<T>(kind: string): T[] {
  return (
    db
      .prepare("SELECT body FROM records WHERE kind=? ORDER BY id")
      .all(kind) as { body: string }[]
  ).map((r) => JSON.parse(r.body));
}
export function get<T>(kind: string, id: string): T | undefined {
  const row = db
    .prepare("SELECT body FROM records WHERE kind=? AND id=?")
    .get(kind, id) as { body: string } | undefined;
  return row ? JSON.parse(row.body) : undefined;
}
export function write(
  kind: string,
  id: string,
  value: unknown,
  actor: string,
  action = "save",
): void {
  if (!db.inTransaction)
    return db.transaction(() => write(kind, id, value, actor, action))();
  const old = get(kind, id);
  db.prepare(
    "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
  ).run(kind, id, JSON.stringify(value));
  const refs: Record<string, Record<string, string>> = {
    games: { home: "teams", away: "teams" },
    players: { team: "teams" },
    stats: { game: "games", player: "players" },
    events: { game: "games" },
    teamStats: { game: "games", team: "teams" },
  };
  db.prepare("DELETE FROM entity_refs WHERE owner_kind=? AND owner_id=?").run(
    kind,
    id,
  );
  for (const [field, target] of Object.entries(refs[kind] || {})) {
    const targetId = (value as Record<string, unknown>)[field];
    if (typeof targetId !== "string") throw Error("Missing reference");
    db.prepare("INSERT INTO entity_refs VALUES(?,?,?,?,?)").run(
      kind,
      id,
      field,
      target,
      targetId,
    );
  }
  db.prepare(
    "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,?)",
  ).run(
    actor,
    kind,
    id,
    old ? JSON.stringify(old) : null,
    JSON.stringify(value),
    new Date().toISOString(),
    action,
  );
  db.prepare("UPDATE revision SET value=value+1 WHERE id=1").run();
}
export const revision = () =>
  (
    db.prepare("SELECT value FROM revision WHERE id=1").get() as {
      value: number;
    }
  ).value;
const defaults: Settings = {
  name: "FIBA Africa Champions Clubs – Road to BAL 2027",
  shortName: "ROAD TO BAL 2027",
  start: "2026-10-21T00:00:00+02:00",
  end: "2026-10-26T00:00:00+02:00",
  timezone: "Africa/Tripoli",
  city: "طرابلس، ليبيا",
  venue: "",
  hero: "طرابلس تستضيف أفريقيا",
  announcement: "21–25 أكتوبر 2026 · المجموعتان A وB",
  groups: ["A", "B"],
  qualificationSlots: 2,
  winPoints: 2,
  lossPoints: 1,
  rulesConfirmed: false,
  featuredGameId: null,
};
if (!get("settings", "tournament"))
  db.transaction(() => {
    write("settings", "tournament", defaults, "seed");
    const teams = [
      ["al-ittihad", "Al Ittihad", "ليبيا", "A"],
      ["stade-malien", "Stade Malien", "مالي", "A"],
      ["nb-staoueli", "NB Staoueli", "الجزائر", "A"],
      ["nabaya-sofas", "Nabaya Sofas", "غينيا", "A"],
      ["kriol-star", "Kriol Star", "الرأس الأخضر", "A"],
      ["spintex-knights", "Spintex Knights", "غانا", "B"],
      ["as-douanes", "AS Douanes", "بوركينا فاسو", "B"],
      ["energie-bc", "Energie BC", "بنين", "B"],
      ["npa-pythons", "NPA Pythons", "ليبيريا", "B"],
      ["red-flames", "Red Flames", "سيراليون", "B"],
    ];
    for (const [id, name, country, group] of teams)
      write(
        "teams",
        id,
        {
          id,
          name,
          country,
          group,
          verified: id !== "nb-staoueli",
        },
        "seed",
      );
  })();
export function settings() {
  return settingsSchema.parse(get("settings", "tournament"));
}
export interface TournamentDataProvider {
  getTournament(): Settings;
  getTeams(): Team[];
  getTeam(id: string): Team | undefined;
  getGames(): Game[];
  getGame(id: string): Game | undefined;
  getPlayers(): unknown[];
  getNews(): News[];
  getBoxScore(id: string): unknown[];
  getPlayByPlay(id: string): unknown[];
  getStandings(group: string): ReturnType<typeof standings>;
  getLeaders(): unknown[];
}
export class ManualProvider implements TournamentDataProvider {
  getTournament() {
    return settings();
  }
  getTeams() {
    return list<Team>("teams").map((t) => teamSchema.parse(t));
  }
  getTeam(id: string) {
    return this.getTeams().find((t) => t.id === id);
  }
  getGames() {
    return list<Game>("games").map((g) => gameSchema.parse(g));
  }
  getGame(id: string) {
    return this.getGames().find((g) => g.id === id);
  }
  getPlayers() {
    return list("players");
  }
  getNews() {
    return list<News>("news").filter((n) => n.status === "published");
  }
  getBoxScore(id: string) {
    return list<{ game: string }>("stats").filter((s) => s.game === id);
  }
  getPlayByPlay(id: string) {
    return list<{ game: string }>("events").filter((s) => s.game === id);
  }
  getStandings(group: string) {
    return standings(
      this.getTeams().filter((t) => t.group === group),
      this.getGames(),
      this.getTournament(),
    );
  }
  getLeaders() {
    return list("stats");
  }
}
export const provider = new ManualProvider();
export const schemas = {
  events: eventSchema,
  teamStats: teamStatSchema,
  teams: teamSchema,
  games: gameSchema,
  settings: settingsSchema,
  news: newsSchema,
  players: playerSchema,
  stats: statSchema,
  pulse: pulseSchema,
};
export function provision(password: string) {
  if (password.length < 14) throw Error("Use at least 14 characters");
  const salt = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO admins VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,hash=excluded.hash",
  ).run("admin", salt, scryptSync(password, salt, 64).toString("hex"));
  db.prepare("DELETE FROM sessions").run();
}
export function login(password: string) {
  const row = db.prepare("SELECT * FROM admins WHERE id=?").get("admin") as
    | { salt: string; hash: string }
    | undefined;
  if (
    !row ||
    !timingSafeEqual(
      scryptSync(password, row.salt, 64),
      Buffer.from(row.hash, "hex"),
    )
  )
    return null;
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    createHash("sha256").update(token).digest("hex"),
    "admin",
    Date.now() + 8 * 3600000,
  );
  return token;
}
export function authorize(token: string | undefined) {
  if (!token) return null;
  return (
    (
      db
        .prepare("SELECT admin FROM sessions WHERE token=? AND expires>?")
        .get(createHash("sha256").update(token).digest("hex"), Date.now()) as
        | { admin: string }
        | undefined
    )?.admin || null
  );
}
export function rateLimit(key: string, max: number, window = 60000) {
  return db.transaction(() => {
    const now = Date.now();
    db.prepare("DELETE FROM rate_limits WHERE expires<?").run(now);
    const r = db
      .prepare("SELECT count FROM rate_limits WHERE key=?")
      .get(key) as { count: number } | undefined;
    if (r && r.count >= max) return false;
    db.prepare(
      "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    ).run(key, now + window);
    return true;
  })();
}

export function revoke(token: string | undefined) {
  if (token)
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      createHash("sha256").update(token).digest("hex"),
    );
}
