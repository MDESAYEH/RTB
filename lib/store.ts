import type { z } from "zod";
import {
  SqlDatabase,
  databaseConfig,
  type DatabaseConfig,
} from "./sql-database";
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
import { storageSchema } from "./storage-schema";
export interface TournamentDataProvider {
  getTournament(): Promise<Settings>;
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  getGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | undefined>;
  getPlayers(): Promise<unknown[]>;
  getNews(): Promise<News[]>;
  getBoxScore(id: string): Promise<unknown[]>;
  getPlayByPlay(id: string): Promise<unknown[]>;
  getStandings(group: string): Promise<ReturnType<typeof standings>>;
  getLeaders(): Promise<unknown[]>;
}
export function createTournamentStore(
  config: () => DatabaseConfig = databaseConfig,
) {
  const db = new SqlDatabase(config, initializeStore);
  async function initializeStore() {
    const selected = config();
    if (selected.kind === "libsql" && !selected.url.startsWith("file:")) {
      const version = await db.prepare("PRAGMA user_version").get();
      if (Number(version?.user_version) < 5)
        throw Error(
          "Turso database is not initialized: run db:import from a verified SQLite snapshot before serving traffic",
        );
      const row = await db
        .prepare(
          "SELECT body FROM records WHERE kind='settings' AND id='tournament'",
        )
        .get();
      if (!row)
        throw Error(
          "Turso database has no tournament settings; run db:import before serving traffic",
        );
      return;
    }
    await db.exec(
      `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL CHECK(json_valid(body)),PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS records_kind ON records(kind);CREATE UNIQUE INDEX IF NOT EXISTS news_slug ON records(json_extract(body,'$.slug')) WHERE kind='news';CREATE UNIQUE INDEX IF NOT EXISTS stat_identity ON records(json_extract(body,'$.game'),json_extract(body,'$.player')) WHERE kind='stats';CREATE UNIQUE INDEX IF NOT EXISTS team_stat_identity ON records(json_extract(body,'$.game'),json_extract(body,'$.team')) WHERE kind='teamStats';CREATE TABLE IF NOT EXISTS entity_refs(owner_kind TEXT NOT NULL,owner_id TEXT NOT NULL,field TEXT NOT NULL,target_kind TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(owner_kind,owner_id,field),FOREIGN KEY(owner_kind,owner_id) REFERENCES records(kind,id) ON DELETE CASCADE,FOREIGN KEY(target_kind,target_id) REFERENCES records(kind,id));CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY,salt TEXT NOT NULL,hash TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,admin TEXT NOT NULL REFERENCES admins(id),expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,old TEXT,new TEXT,time TEXT NOT NULL);CREATE INDEX IF NOT EXISTS audit_target ON audit(target,id);CREATE TABLE IF NOT EXISTS undo(id INTEGER PRIMARY KEY,game TEXT NOT NULL,body TEXT NOT NULL);CREATE TABLE IF NOT EXISTS revision(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL);INSERT OR IGNORE INTO revision VALUES(1,0);CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`,
    );
    // Versioned, additive migration: existing records and audit history are retained.
    if (
      (
        (await db.prepare("PRAGMA user_version").get()) as {
          user_version: number;
        }
      ).user_version < 2
    ) {
      await db.transaction(async () => {
        const columns = (await db
          .prepare("PRAGMA table_info(audit)")
          .all()) as {
          name: string;
        }[];
        if (!columns.some((c) => c.name === "reason"))
          await db.exec("ALTER TABLE audit ADD COLUMN reason TEXT");
        await db.exec(
          "CREATE TABLE IF NOT EXISTS commands(actor TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,time INTEGER NOT NULL,PRIMARY KEY(actor,id)); PRAGMA user_version=2",
        );
      })();
    }
    if (
      (
        (await db.prepare("PRAGMA user_version").get()) as {
          user_version: number;
        }
      ).user_version < 3
    ) {
      await db.transaction(async () => {
        await db.exec(
          "ALTER TABLE audit ADD COLUMN action TEXT; PRAGMA user_version=3",
        );
      })();
    }
    await db.exec(storageSchema);
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
    if (!(await get("settings", "tournament")))
      await db.transaction(async () => {
        await write("settings", "tournament", defaults, "seed");
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
          await write(
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
  }
  async function list<T>(kind: string): Promise<T[]> {
    return (
      (await db
        .prepare("SELECT body FROM records WHERE kind=? ORDER BY id")
        .all(kind)) as {
        body: string;
      }[]
    ).map((r) => JSON.parse(r.body));
  }
  async function get<T>(kind: string, id: string): Promise<T | undefined> {
    const row = (await db
      .prepare("SELECT body FROM records WHERE kind=? AND id=?")
      .get(kind, id)) as
      | {
          body: string;
        }
      | undefined;
    return row ? JSON.parse(row.body) : undefined;
  }
  async function write(
    kind: string,
    id: string,
    value: unknown,
    actor: string,
    action = "save",
  ): Promise<void> {
    if (!db.inTransaction)
      return await db.transaction(
        async () => await write(kind, id, value, actor, action),
      )();
    const old = await get(kind, id);
    const refs: Record<string, Record<string, string>> = {
      games: { home: "teams", away: "teams" },
      players: { team: "teams" },
      stats: { game: "games", player: "players" },
      events: { game: "games" },
      teamStats: { game: "games", team: "teams" },
    };
    const statements: {
      sql: string;
      args: import("@libsql/client").InValue[];
    }[] = [
      {
        sql: "INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
        args: [kind, id, JSON.stringify(value)],
      },
      {
        sql: "DELETE FROM entity_refs WHERE owner_kind=? AND owner_id=?",
        args: [kind, id],
      },
    ];
    for (const [field, target] of Object.entries(refs[kind] || {})) {
      const targetId = (value as Record<string, unknown>)[field];
      if (typeof targetId !== "string") throw Error("Missing reference");
      statements.push({
        sql: "INSERT INTO entity_refs VALUES(?,?,?,?,?)",
        args: [kind, id, field, target, targetId],
      });
    }
    statements.push({
      sql: "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,?)",
      args: [
        actor,
        kind,
        id,
        old ? JSON.stringify(old) : null,
        JSON.stringify(value),
        new Date().toISOString(),
        action,
      ],
    });
    statements.push({
      sql: "UPDATE revision SET value=value+1 WHERE id=1",
      args: [],
    });
    await db.batch(statements);
  }
  const revision = async () =>
    (
      (await db.prepare("SELECT value FROM revision WHERE id=1").get()) as {
        value: number;
      }
    ).value;
  async function settings() {
    return settingsSchema.parse(await get("settings", "tournament"));
  }
  class ManualProvider implements TournamentDataProvider {
    async getTournament() {
      return await settings();
    }
    async getTeams() {
      return (await list<Team>("teams")).map((t) => teamSchema.parse(t));
    }
    async getTeam(id: string) {
      return (await this.getTeams()).find((t) => t.id === id);
    }
    async getGames() {
      return (await list<Game>("games")).map((g) => gameSchema.parse(g));
    }
    async getGame(id: string) {
      return (await this.getGames()).find((g) => g.id === id);
    }
    async getPlayers() {
      return await list("players");
    }
    async getNews() {
      return (await list<News>("news")).filter((n) => n.status === "published");
    }
    async getBoxScore(id: string) {
      return (
        await list<{
          game: string;
        }>("stats")
      ).filter((s) => s.game === id);
    }
    async getPlayByPlay(id: string) {
      return (
        await list<{
          game: string;
        }>("events")
      ).filter((s) => s.game === id);
    }
    async getStandings(group: string) {
      return standings(
        (await this.getTeams()).filter((t) => t.group === group),
        await this.getGames(),
        await this.getTournament(),
      );
    }
    async getLeaders() {
      return await list("stats");
    }
  }
  const provider = new ManualProvider();
  const schemas = {
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
  async function provision(password: string) {
    if (password.length < 14) throw Error("Use at least 14 characters");
    const salt = randomBytes(16).toString("hex");
    await db.transaction(async () => {
      await db
        .prepare(
          "INSERT INTO admins VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,hash=excluded.hash",
        )
        .run("admin", salt, scryptSync(password, salt, 64).toString("hex"));
      await db.prepare("DELETE FROM sessions").run();
    })();
  }
  async function login(password: string) {
    return db.transaction(async () => {
      const row = (await db
        .prepare("SELECT * FROM admins WHERE id=?")
        .get("admin")) as
        | {
            salt: string;
            hash: string;
          }
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
      await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(
          createHash("sha256").update(token).digest("hex"),
          "admin",
          Date.now() + 8 * 3600000,
        );
      return token;
    })();
  }
  async function authorize(token: string | undefined) {
    if (!token) return null;
    return (
      (
        (await db
          .prepare("SELECT admin FROM sessions WHERE token=? AND expires>?")
          .get(
            createHash("sha256").update(token).digest("hex"),
            Date.now(),
          )) as
          | {
              admin: string;
            }
          | undefined
      )?.admin || null
    );
  }
  async function rateLimit(key: string, max: number, window = 60000) {
    return await db.transaction(async () => {
      const now = Date.now();
      await db.prepare("DELETE FROM rate_limits WHERE expires<?").run(now);
      const r = (await db
        .prepare("SELECT count FROM rate_limits WHERE key=?")
        .get(key)) as
        | {
            count: number;
          }
        | undefined;
      if (r && r.count >= max) return false;
      await db
        .prepare(
          "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
        )
        .run(key, now + window);
      return true;
    })();
  }
  async function revoke(token: string | undefined) {
    if (token)
      await db
        .prepare("DELETE FROM sessions WHERE token=?")
        .run(createHash("sha256").update(token).digest("hex"));
  }

  async function snapshotData() {
    return db.transaction(async () => {
      const rows = await db
        .prepare("SELECT kind,id,body FROM records ORDER BY id")
        .all();
      const collection = <T>(kind: string): T[] =>
        rows
          .filter((row) => row.kind === kind)
          .map((row) => JSON.parse(String(row.body)));
      return {
        settings: settingsSchema.parse(
          JSON.parse(
            String(
              rows.find(
                (row) => row.kind === "settings" && row.id === "tournament",
              )?.body,
            ),
          ),
        ),
        teams: collection<Team>("teams").map((team) => teamSchema.parse(team)),
        games: collection<Game>("games").map((game) => gameSchema.parse(game)),
        players: collection<unknown>("players"),
        news: collection<News>("news").filter(
          (news) => news.status === "published",
        ),
        stats: collection<unknown>("stats"),
        events: collection<z.infer<typeof eventSchema>>("events"),
        teamStats: collection<z.infer<typeof teamStatSchema>>("teamStats"),
        pulse: collection<z.infer<typeof pulseSchema>>("pulse"),
        revision: await revision(),
      };
    }, "read")();
  }
  return {
    db,
    snapshotData,
    list,
    get,
    write,
    revision,
    settings,
    provider,
    schemas,
    provision,
    login,
    authorize,
    rateLimit,
    revoke,
  };
}
export const store = createTournamentStore();
export const {
  db,
  snapshotData,
  list,
  get,
  write,
  revision,
  settings,
  provider,
  schemas,
  provision,
  login,
  authorize,
  rateLimit,
  revoke,
} = store;
export type TournamentStore = ReturnType<typeof createTournamentStore>;
