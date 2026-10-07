import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Client, Transaction, InValue } from "@libsql/client";
import { LocalDatabase } from "./database";
import { assertLocalStorageAllowed, isVercel } from "./storage-config";

type Row = Record<string, unknown>;
type Executor = {
  query(sql: string, args: InValue[]): Promise<Row[]>;
  batch(statements: { sql: string; args?: InValue[] }[]): Promise<void>;
  exec(sql: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  active: boolean;
};
// A synchronous SQLite BEGIN must not block this process while another async
// transaction on the same file is awaiting. The database lock still protects other processes.
const localQueues = new Map<string, { tail: Promise<unknown> }>();

export type DatabaseConfig =
  | { kind: "sqlite"; path: string }
  | { kind: "libsql"; url: string; authToken?: string };
export function databaseConfig(env = process.env): DatabaseConfig {
  if (env.TURSO_DATABASE_URL) {
    const url = new URL(env.TURSO_DATABASE_URL);
    if (
      !["libsql:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error(
        "TURSO_DATABASE_URL must be a remote libsql:// or https:// URL",
      );
    if (!env.TURSO_AUTH_TOKEN)
      throw Error("TURSO_AUTH_TOKEN is required with TURSO_DATABASE_URL");
    if (isVercel(env)) {
      let site: URL;
      try {
        site = new URL(env.SITE_URL || "");
      } catch {
        throw Error("SITE_URL must be the exact HTTPS Vercel origin");
      }
      if (
        site.protocol !== "https:" ||
        site.username ||
        site.password ||
        site.pathname !== "/" ||
        site.search ||
        site.hash
      )
        throw Error("SITE_URL must be the exact HTTPS Vercel origin");
      if (!env.BLOB_READ_WRITE_TOKEN)
        throw Error(
          "BLOB_READ_WRITE_TOKEN is required for the Private Blob store on Vercel",
        );
    }
    return { kind: "libsql", url: url.href, authToken: env.TURSO_AUTH_TOKEN };
  }
  if (env.TURSO_AUTH_TOKEN || isVercel(env))
    throw Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required on Vercel; local SQLite is disabled",
    );
  return {
    kind: "sqlite",
    path: resolve(
      /* turbopackIgnore: true */ env.DATABASE_PATH || "data/road.db",
    ),
  };
}

/** Async transaction scope belongs to the request, never to a global current connection. */
export class SqlDatabase {
  private context = new AsyncLocalStorage<Executor>();
  private local?: LocalDatabase;
  private client?: Client;
  private serialize = false;
  private opening?: Promise<void>;
  private initialized?: Promise<void>;
  private queue = { tail: Promise.resolve() as Promise<unknown> };
  constructor(
    private config: () => DatabaseConfig,
    private initialize?: (db: SqlDatabase) => Promise<void>,
  ) {}
  get inTransaction() {
    return this.context.getStore()?.active === true;
  }
  private async open() {
    if (!this.opening)
      this.opening = (async () => {
        const config = this.config();
        if (config.kind === "sqlite" || config.url.startsWith("file:")) {
          assertLocalStorageAllowed();
          this.serialize = true;
          const key =
            config.kind === "sqlite" ? resolve(config.path) : config.url;
          this.queue = localQueues.get(key) ?? { tail: Promise.resolve() };
          localQueues.set(key, this.queue);
        }
        if (config.kind === "sqlite") {
          assertLocalStorageAllowed();
          await mkdir(dirname(config.path), { recursive: true });
          this.local = new LocalDatabase(config.path);
          this.local.pragma("journal_mode=WAL");
          this.local.pragma("foreign_keys=ON");
          this.local.pragma("busy_timeout=5000");
        } else {
          const { createClient } = config.url.startsWith("file:")
            ? await import("@libsql/client")
            : await import("@libsql/client/web");
          this.client = createClient({
            url: config.url,
            authToken: config.authToken,
            intMode: "number",
          });
        }
      })().catch((error) => {
        this.opening = undefined;
        throw error;
      });
    await this.opening;
  }
  private exclusive<T>(fn: () => Promise<T>) {
    const task = this.queue.tail.then(fn, fn);
    this.queue.tail = task.catch(() => undefined);
    return task;
  }
  async ready() {
    if (this.context.getStore()) return;
    await this.open();
    if (!this.initialized)
      this.initialized = this.initialize
        ? this.rawTransaction(() => this.initialize!(this)).catch((error) => {
            this.initialized = undefined;
            throw error;
          })
        : Promise.resolve();
    await this.initialized;
  }
  private scope() {
    const scope = this.context.getStore();
    if (scope && !scope.active) throw Error("Transaction scope is closed");
    return scope;
  }
  prepare(sql: string) {
    const query = async (...args: InValue[]) => {
      const scope = this.scope();
      if (scope) return scope.query(sql, args);
      await this.ready();
      if (this.local)
        return this.exclusive(async () =>
          this.local!.prepare(sql).all(
            ...(args as Parameters<
              ReturnType<LocalDatabase["prepare"]>["all"]
            >),
          ),
        );
      const execute = async () =>
        (await this.client!.execute({ sql, args })).rows as unknown as Row[];
      return this.serialize ? this.exclusive(execute) : execute();
    };
    return {
      all: query,
      get: async (...args: InValue[]) => (await query(...args))[0],
      run: async (...args: InValue[]) => {
        await query(...args);
      },
    };
  }
  async exec(sql: string) {
    const scope = this.scope();
    if (scope) return scope.exec(sql);
    await this.ready();
    if (this.local)
      return this.exclusive(async () => {
        this.local!.exec(sql);
      });
    const execute = async () => {
      await this.client!.executeMultiple(sql);
    };
    await (this.serialize ? this.exclusive(execute) : execute());
  }
  pragma(sql: string) {
    return this.exec("PRAGMA " + sql);
  }
  async batch(statements: { sql: string; args?: InValue[] }[]): Promise<void> {
    const scope = this.scope();
    if (!scope) return this.transaction(async () => this.batch(statements))();
    await scope.batch(statements);
  }
  transaction<T>(fn: () => Promise<T>, mode: "read" | "write" = "write") {
    return async () => {
      if (this.scope()) return fn();
      await this.ready();
      return this.rawTransaction(fn, mode);
    };
  }
  private async rawTransaction<T>(
    fn: () => Promise<T>,
    mode: "read" | "write" = "write",
  ): Promise<T> {
    const execute = async () => {
      let tx: Transaction | undefined;
      if (this.local)
        this.local.exec(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN");
      else {
        // Retry only acquisition; never replay the body or an uncertain COMMIT.
        for (let attempt = 0; ; attempt++) {
          try {
            tx = await this.client!.transaction(mode);
            const check = await tx.execute("PRAGMA foreign_keys");
            if (Number(check.rows[0]?.foreign_keys) !== 1)
              throw Error("Database must enforce foreign keys");
            break;
          } catch (error) {
            tx?.close();
            if (
              attempt >= 3 ||
              !["SQLITE_BUSY", "SQLITE_LOCKED"].includes(
                (error as { code?: string }).code || "",
              )
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 50 * 2 ** attempt),
            );
          }
        }
      }
      const scope: Executor = {
        active: true,
        batch: async (statements) => {
          if (this.local) {
            for (const statement of statements)
              this.local
                .prepare(statement.sql)
                .all(
                  ...((statement.args || []) as Parameters<
                    ReturnType<LocalDatabase["prepare"]>["all"]
                  >),
                );
          } else await tx!.batch(statements);
        },
        query: async (sql, args) =>
          this.local
            ? this.local
                .prepare(sql)
                .all(
                  ...(args as Parameters<
                    ReturnType<LocalDatabase["prepare"]>["all"]
                  >),
                )
            : ((await tx!.execute({ sql, args })).rows as unknown as Row[]),
        exec: async (sql) => {
          if (this.local) this.local.exec(sql);
          else await tx!.executeMultiple(sql);
        },
        commit: async () => {
          if (this.local) this.local.exec("COMMIT");
          else await tx!.commit();
        },
        rollback: async () => {
          if (this.local) this.local.exec("ROLLBACK");
          else await tx!.rollback();
        },
      };
      try {
        const result = await this.context.run(scope, fn);
        await scope.commit();
        return result;
      } catch (error) {
        try {
          await scope.rollback();
        } catch {
          /* Preserve the original failure, including uncertain commit. */
        }
        throw error;
      } finally {
        scope.active = false;
        tx?.close();
      }
    };
    return this.serialize ? this.exclusive(execute) : execute();
  }
  async close() {
    await this.queue.tail;
    this.local?.close();
    this.client?.close();
  }
}
