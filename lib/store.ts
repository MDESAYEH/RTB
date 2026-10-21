import type { z } from "zod";
import {
  SqlDatabase,
  databaseConfig,
  type DatabaseConfig,
} from "./sql-database";
import { randomBytes, createHash } from "node:crypto";
import { dummyVerify, hashPassword, verifyPassword } from "./password";
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
import { storageSchema, storageSchemaVersion } from "./storage-schema";
import { isRole } from "./permissions";
import { normalizeIdentifier } from "./identifier";
import { derivedPlayerStats } from "./derived-stats";
import {
  generateRecoveryCodes,
  generateSecret,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "./totp";
import { open as openSecret, seal, twoFactorConfigured } from "./secret-box";
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
      const migrationTable = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_imports'",
        )
        .get();

      if (!migrationTable)
        throw Error(
          "Turso database is not initialized: run db:import from a verified SQLite snapshot before serving traffic",
        );

      const imported = await db
        .prepare(
          "SELECT fingerprint FROM migration_imports WHERE id='sqlite-import'",
        )
        .get();

      if (!imported?.fingerprint)
        throw Error(
          "Turso database import is incomplete: run db:import from a verified SQLite snapshot before serving traffic",
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
        const columns = (await db
          .prepare("PRAGMA table_info(audit)")
          .all()) as {
          name: string;
        }[];

        if (!columns.some((column) => column.name === "action")) {
          await db.exec("ALTER TABLE audit ADD COLUMN action TEXT");
        }

        await db.exec("PRAGMA user_version=3");
      })();
    }
    // Additive: named accounts with roles. The legacy password-only row keeps working until a named owner exists.
    {
      const columns = (await db.prepare("PRAGMA table_info(admins)").all()) as {
        name: string;
      }[];
      if (!columns.some((c) => c.name === "identifier"))
        await db.exec("ALTER TABLE admins ADD COLUMN identifier TEXT");
      if (!columns.some((c) => c.name === "role"))
        await db.exec(
          "ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'",
        );
      if (!columns.some((c) => c.name === "disabled"))
        await db.exec(
          "ALTER TABLE admins ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0",
        );
      if (!columns.some((c) => c.name === "totp_secret"))
        await db.exec("ALTER TABLE admins ADD COLUMN totp_secret TEXT");
      if (!columns.some((c) => c.name === "totp_enabled"))
        await db.exec(
          "ALTER TABLE admins ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0",
        );
      if (!columns.some((c) => c.name === "totp_last"))
        await db.exec(
          "ALTER TABLE admins ADD COLUMN totp_last INTEGER NOT NULL DEFAULT 0",
        );
      if (!columns.some((c) => c.name === "recovery"))
        await db.exec("ALTER TABLE admins ADD COLUMN recovery TEXT");
      await db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS admins_identifier ON admins(identifier) WHERE identifier IS NOT NULL",
      );
    }
    await db.exec(storageSchema);
    await db.exec(`PRAGMA user_version=${storageSchemaVersion}`);
    // One-time correction: the event runs three days (21–23 October). Only untouched old defaults are changed;
    // anything an organiser edited stays as they set it.
    {
      const OLD_END = "2026-10-26T00:00:00+02:00";
      const OLD_ANNOUNCEMENT = "21–25 أكتوبر 2026 · المجموعتان A وB";
      // The countdown runs to the first game, 11:00 on 21 October (Tripoli), not to midnight.
      const OLD_START = "2026-10-21T00:00:00+02:00";
      const FIRST_GAME = "2026-10-21T11:00:00+02:00";
      const current = await get<Settings>("settings", "tournament");
      if (
        current &&
        (current.end === OLD_END ||
          current.announcement === OLD_ANNOUNCEMENT ||
          current.start === OLD_START)
      )
        await write(
          "settings",
          "tournament",
          {
            ...current,
            start: current.start === OLD_START ? FIRST_GAME : current.start,
            end: current.end === OLD_END ? "2026-10-24T00:00:00+02:00" : current.end,
            announcement:
              current.announcement === OLD_ANNOUNCEMENT
                ? "21–23 أكتوبر 2026، المجموعتان A وB"
                : current.announcement,
          },
          "system",
          "migrate",
        );
    }
    const defaults: Settings = {
      name: "FIBA Africa Champions Clubs – Road to BAL 2027",
      shortName: "ROAD TO BAL 2027",
      start: "2026-10-21T11:00:00+02:00",

      end: "2026-10-24T00:00:00+02:00",
      timezone: "Africa/Tripoli",
      city: "طرابلس، ليبيا",
      venue: "",
      hero: "طرابلس تستضيف أفريقيا",
      announcement: "21–23 أكتوبر 2026، المجموعتان A وB",
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
  /**
   * Deletes a record and writes the audit trail. Returns false (and changes nothing) while other records
   * still reference it, e.g. a team that still has players.
   */
  async function remove(
    kind: string,
    id: string,
    actor: string,
    action = "remove",
  ): Promise<boolean> {
    if (!db.inTransaction)
      return await db.transaction(
        async () => await remove(kind, id, actor, action),
      )();
    const old = await get(kind, id);
    if (!old) return true;
    const used = await db
      .prepare(
        "SELECT 1 AS used FROM entity_refs WHERE target_kind=? AND target_id=? LIMIT 1",
      )
      .get(kind, id);
    if (used) return false;
    await db.batch([
      {
        sql: "DELETE FROM entity_refs WHERE owner_kind=? AND owner_id=?",
        args: [kind, id],
      },
      { sql: "DELETE FROM records WHERE kind=? AND id=?", args: [kind, id] },
      {
        sql: "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,?)",
        args: [
          actor,
          kind,
          id,
          JSON.stringify(old),
          null,
          new Date().toISOString(),
          action,
        ],
      },
      { sql: "UPDATE revision SET value=value+1 WHERE id=1", args: [] },
    ]);
    return true;
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
  const MIN_PASSWORD = 14;
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  type AccountRow = {
    id: string;
    salt: string;
    hash: string;
    identifier: string | null;
    role: string;
    disabled: number;
    totp_secret: string | null;
    totp_enabled: number;
    totp_last: number;
    recovery: string | null;
  };
  async function provision(
    password: string,
    options: { identifier?: string; role?: string } = {},
  ) {
    if (password.length < MIN_PASSWORD) throw Error("Use at least 14 characters");
    const role = options.role ?? "owner";
    if (!isRole(role)) throw Error("Unknown role");
    let identifier: string | null = null;
    if (options.identifier !== undefined) {
      const parsed = normalizeIdentifier(options.identifier);
      if (!parsed)
        throw Error(
          "Use a valid email address or an international phone number (+218...)",
        );
      identifier = parsed.value;
    }
    const id = identifier ?? "admin";
    // The slow hashing happens before the write transaction opens.
    const secret = await hashPassword(password);
    await db.transaction(async () => {
      await db
        .prepare(
          "INSERT INTO admins(id,salt,hash,identifier,role,disabled) VALUES(?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,identifier=excluded.identifier,role=excluded.role,disabled=0",
        )
        .run(id, secret.salt, secret.hash, identifier, role);
      if (identifier === null) await db.prepare("DELETE FROM sessions").run();
      else {
        await db.prepare("DELETE FROM sessions WHERE admin=?").run(id);
        // The password-only account is retired once a named owner exists.
        if (role === "owner") {
          await db.prepare("DELETE FROM sessions WHERE admin='admin'").run();
          await db
            .prepare("DELETE FROM admins WHERE id='admin' AND identifier IS NULL")
            .run();
        }
      }
    })();
    return id;
  }
  type AuthResult =
    | { status: "ok"; token: string }
    | { status: "otp" }
    | { status: "fail" };
  const recoveryHash = (code: string) => sha(normalizeRecoveryCode(code));
  /**
   * Password check, then the authenticator code when the account has one. A recovery code works once
   * instead of the authenticator code. "otp" means the password was right and a code is still needed.
   */
  async function authenticate(
    password: string,
    identifier?: string,
    otp?: string,
  ): Promise<AuthResult> {
    const parsed =
      identifier === undefined ? null : normalizeIdentifier(identifier);
    const row = (
      identifier === undefined
        ? await db
            .prepare("SELECT * FROM admins WHERE id='admin' AND identifier IS NULL")
            .get()
        : parsed
          ? await db
              .prepare("SELECT * FROM admins WHERE identifier=?")
              .get(parsed.value)
          : undefined
    ) as AccountRow | undefined;
    // Argon2id is deliberately slow and memory-hard, so it runs outside the database transaction.
    // An unknown account pays the same cost, so response time does not reveal which identifiers exist.
    let verdict = { ok: false, needsRehash: false };
    if (row) verdict = await verifyPassword(password, row);
    else await dummyVerify(password);
    if (!row || row.disabled || !verdict.ok) return { status: "fail" } as const;
    // Older (scrypt or weaker) hashes are upgraded after a fully successful sign-in.
    const upgraded = verdict.needsRehash ? await hashPassword(password) : null;
    return db.transaction(async () => {
      if (row.totp_enabled) {
        if (!otp?.trim()) return { status: "otp" } as const;
        if (!(await consumeSecondFactor(row, otp)))
          return { status: "fail" } as const;
      }
      if (upgraded)
        await db
          .prepare("UPDATE admins SET salt=?,hash=? WHERE id=?")
          .run(upgraded.salt, upgraded.hash, row.id);
      const token = randomBytes(32).toString("hex");
      await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      await db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(sha(token), row.id, Date.now() + 8 * 3600000);
      return { status: "ok", token } as const;
    })();
  }
  /** Token or null; accounts with an authenticator need the code, so this is for password-only accounts. */
  async function login(password: string, identifier?: string, otp?: string) {
    const result = await authenticate(password, identifier, otp);
    return result.status === "ok" ? result.token : null;
  }
  /** Accepts a current authenticator code (never the same time step twice) or an unused recovery code. */
  async function consumeSecondFactor(row: AccountRow, code: string) {
    if (!row.totp_secret) return false;
    let secret: string;
    try {
      secret = openSecret(row.totp_secret);
    } catch {
      return false;
    }
    const step = verifyTotp(secret, code, row.totp_last);
    if (step !== null) {
      await db.prepare("UPDATE admins SET totp_last=? WHERE id=?").run(step, row.id);
      return true;
    }
    if (/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(normalizeRecoveryCode(code))) {
      const hashes: string[] = row.recovery ? JSON.parse(row.recovery) : [];
      const hash = recoveryHash(code);
      if (hashes.includes(hash)) {
        await db
          .prepare("UPDATE admins SET recovery=? WHERE id=?")
          .run(JSON.stringify(hashes.filter((h) => h !== hash)), row.id);
        return true;
      }
    }
    return false;
  }
  async function rowFor(id: string) {
    const row = (await db
      .prepare("SELECT * FROM admins WHERE id=?")
      .get(id)) as AccountRow | undefined;
    if (!row) throw Error("الحساب غير موجود");
    return row;
  }
  /** Step 1 of enrolment: a pending secret the user adds to their authenticator app. */
  async function beginTwoFactor(id: string) {
    if (!twoFactorConfigured())
      throw Error("التحقق الثنائي غير مُفعَّل على الخادم (TWO_FACTOR_KEY غير مضبوط).");
    const row = await rowFor(id);
    if (row.totp_enabled) throw Error("التحقق الثنائي مفعَّل مسبقاً");
    const secret = generateSecret();
    await db
      .prepare("UPDATE admins SET totp_secret=?,totp_enabled=0,totp_last=0,recovery=NULL WHERE id=?")
      .run(seal(secret), id);
    return { secret, uri: otpauthUri(secret, row.identifier ?? row.id) };
  }
  /** Step 2: the first valid code turns it on and returns single-use recovery codes (shown once). */
  async function confirmTwoFactor(id: string, code: string) {
    return db.transaction(async () => {
      const row = await rowFor(id);
      if (row.totp_enabled) throw Error("التحقق الثنائي مفعَّل مسبقاً");
      if (!row.totp_secret) throw Error("ابدأ الإعداد أولاً");
      const step = verifyTotp(openSecret(row.totp_secret), code, 0);
      if (step === null) throw Error("الرمز غير صحيح. تأكد من الوقت في هاتفك وحاول مجدداً.");
      const codes = generateRecoveryCodes();
      await db
        .prepare("UPDATE admins SET totp_enabled=1,totp_last=?,recovery=? WHERE id=?")
        .run(step, JSON.stringify(codes.map(recoveryHash)), id);
      return codes;
    })();
  }
  /** Turning it off needs the password and a current code (or recovery code). */
  async function disableTwoFactor(id: string, password: string, otp: string) {
    const passwordOk = (await verifyPassword(password, await rowFor(id))).ok;
    await db.transaction(async () => {
      const row = await rowFor(id);
      const ok =
        passwordOk &&
        (!row.totp_enabled || (await consumeSecondFactor(row, otp)));
      if (!ok) throw Error("كلمة المرور أو الرمز غير صحيح");
      await db
        .prepare("UPDATE admins SET totp_secret=NULL,totp_enabled=0,totp_last=0,recovery=NULL WHERE id=?")
        .run(id);
    })();
  }
  /** An owner clears a colleague's authenticator (lost phone); their sessions end and they re-enrol. */
  async function resetTwoFactor(id: string) {
    await db.transaction(async () => {
      await rowFor(id);
      await db
        .prepare("UPDATE admins SET totp_secret=NULL,totp_enabled=0,totp_last=0,recovery=NULL WHERE id=?")
        .run(id);
      await db.prepare("DELETE FROM sessions WHERE admin=?").run(id);
    })();
  }
  /** The signed-in account behind a session cookie, or null. Disabled accounts lose access immediately. */
  async function principal(token: string | undefined) {
    if (!token) return null;
    return (
      ((await db
        .prepare(
          "SELECT a.id AS id,a.identifier AS identifier,a.role AS role,a.totp_enabled AS twoFactor FROM sessions s JOIN admins a ON a.id=s.admin WHERE s.token=? AND s.expires>? AND a.disabled=0",
        )
        .get(sha(token), Date.now())) as
        | {
            id: string;
            identifier: string | null;
            role: string;
            twoFactor: number;
          }
        | undefined) ?? null
    );
  }
  async function authorize(token: string | undefined) {
    return (await principal(token))?.id ?? null;
  }
  async function listUsers() {
    return (await db
      .prepare(
        "SELECT id,identifier,role,disabled,totp_enabled AS twoFactor FROM admins ORDER BY identifier",
      )
      .all()) as {
      id: string;
      identifier: string | null;
      role: string;
      disabled: number;
      twoFactor: number;
    }[];
  }
  async function otherActiveOwners(id: string) {
    return (
      (await db
        .prepare(
          "SELECT COUNT(*) AS n FROM admins WHERE role='owner' AND disabled=0 AND id!=?",
        )
        .get(id)) as { n: number }
    ).n;
  }
  async function account(id: string) {
    const row = (await db
      .prepare("SELECT id,role FROM admins WHERE id=?")
      .get(id)) as { id: string; role: string } | undefined;
    if (!row) throw Error("الحساب غير موجود");
    return row;
  }
  async function createUser(identifier: string, password: string, role: string) {
    if (!isRole(role)) throw Error("دور غير معروف");
    const parsed = normalizeIdentifier(identifier);
    if (!parsed)
      throw Error("أدخل بريداً إلكترونياً صحيحاً أو رقم هاتف دولياً يبدأ بـ +");
    if (password.length < MIN_PASSWORD)
      throw Error("كلمة المرور يجب ألا تقل عن 14 حرفاً");
    const secret = await hashPassword(password);
    await db.transaction(async () => {
      if (await db.prepare("SELECT id FROM admins WHERE id=?").get(parsed.value))
        throw Error("هذا الحساب موجود مسبقاً");
      await db
        .prepare(
          "INSERT INTO admins(id,salt,hash,identifier,role,disabled) VALUES(?,?,?,?,?,0)",
        )
        .run(
          parsed.value,
          secret.salt,
          secret.hash,
          parsed.value,
          role,
        );
    })();
    return parsed.value;
  }
  async function setUserRole(id: string, role: string) {
    if (!isRole(role)) throw Error("دور غير معروف");
    await db.transaction(async () => {
      const target = await account(id);
      if (
        target.role === "owner" &&
        role !== "owner" &&
        !(await otherActiveOwners(id))
      )
        throw Error("لا يمكن إزالة آخر مالك للنظام");
      await db.prepare("UPDATE admins SET role=? WHERE id=?").run(role, id);
    })();
  }
  async function setUserDisabled(id: string, disabled: boolean) {
    await db.transaction(async () => {
      const target = await account(id);
      if (disabled && target.role === "owner" && !(await otherActiveOwners(id)))
        throw Error("لا يمكن تعطيل آخر مالك للنظام");
      await db
        .prepare("UPDATE admins SET disabled=? WHERE id=?")
        .run(disabled ? 1 : 0, id);
      if (disabled) await db.prepare("DELETE FROM sessions WHERE admin=?").run(id);
    })();
  }
  async function resetPassword(id: string, password: string) {
    if (password.length < MIN_PASSWORD)
      throw Error("كلمة المرور يجب ألا تقل عن 14 حرفاً");
    const secret = await hashPassword(password);
    await db.transaction(async () => {
      await account(id);
      await db
        .prepare("UPDATE admins SET salt=?,hash=? WHERE id=?")
        .run(secret.salt, secret.hash, id);
      await db.prepare("DELETE FROM sessions WHERE admin=?").run(id);
    })();
  }
  async function deleteUser(id: string) {
    await db.transaction(async () => {
      const target = await account(id);
      if (target.role === "owner" && !(await otherActiveOwners(id)))
        throw Error("لا يمكن حذف آخر مالك للنظام");
      await db.prepare("DELETE FROM sessions WHERE admin=?").run(id);
      await db.prepare("DELETE FROM admins WHERE id=?").run(id);
    })();
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
  async function rateLimitReset(key: string) {
    await db.prepare("DELETE FROM rate_limits WHERE key=?").run(key);
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
      // Chronological, whatever order the matches were stored in: day by day, then by kickoff.
      const games = collection<Game>("games")
        .map((game) => gameSchema.parse(game))
        .sort(
          (x, y) =>
            Date.parse(x.date) - Date.parse(y.date) || x.id.localeCompare(y.id),
        );
      const storedStats = collection<{ game: string; player: string }>("stats");
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
        games,
        players: collection<unknown>("players"),
        news: collection<News>("news").filter(
          (news) => news.status === "published",
        ),
        stats: [...storedStats, ...derivedPlayerStats(games, storedStats)],
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
    remove,
    revision,
    settings,
    provider,
    schemas,
    provision,
    login,
    authenticate,
    beginTwoFactor,
    confirmTwoFactor,
    disableTwoFactor,
    resetTwoFactor,
    authorize,
    principal,
    listUsers,
    createUser,
    setUserRole,
    setUserDisabled,
    resetPassword,
    deleteUser,
    rateLimit,
    rateLimitReset,
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
  remove,
  revision,
  settings,
  provider,
  schemas,
  provision,
  login,
  authenticate,
  beginTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  resetTwoFactor,
  authorize,
  principal,
  listUsers,
  createUser,
  setUserRole,
  setUserDisabled,
  resetPassword,
  deleteUser,
  rateLimit,
  rateLimitReset,
  revoke,
} = store;
export type TournamentStore = ReturnType<typeof createTournamentStore>;
