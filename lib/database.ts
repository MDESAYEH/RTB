import { DatabaseSync } from "node:sqlite";
import { assertLocalStorageAllowed } from "./storage-config";
/** Synchronous single-host SQLite adapter. Transactions fail atomically. */
export class LocalDatabase {
  private database: DatabaseSync;
  constructor(path: string) {
    assertLocalStorageAllowed();
    this.database = new DatabaseSync(path);
  }
  exec(sql: string) {
    this.database.exec(sql);
  }
  pragma(sql: string) {
    this.database.exec("PRAGMA " + sql);
  }
  prepare(sql: string) {
    return this.database.prepare(sql);
  }
  close() {
    this.database.close();
  }
  get inTransaction() {
    return this.database.isTransaction;
  }
  /** Synchronous only: an async callback would commit before its awaits run. */
  transaction<T>(fn: () => T extends PromiseLike<unknown> ? never : T) {
    return () => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        if (result instanceof Promise)
          throw Error(
            "LocalDatabase.transaction requires a synchronous callback",
          );
        this.database.exec("COMMIT");
        return result;
      } catch (e) {
        this.database.exec("ROLLBACK");
        throw e;
      }
    };
  }
}
