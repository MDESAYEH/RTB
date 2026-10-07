import { DatabaseSync } from "node:sqlite";
/** Synchronous single-host SQLite adapter. Transactions fail atomically. */
export class LocalDatabase {
  private database: DatabaseSync;
  constructor(path: string) {
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
  transaction<T>(fn: () => T) {
    return () => {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        this.database.exec("COMMIT");
        return result;
      } catch (e) {
        this.database.exec("ROLLBACK");
        throw e;
      }
    };
  }
}
