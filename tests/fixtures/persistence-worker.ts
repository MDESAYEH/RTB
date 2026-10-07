import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { createTournamentStore, type TournamentStore } from "../../lib/store";
import { applyCommand, ConflictError } from "../../lib/admin-command";
import {
  adminCommandSchema,
  type AdminCommand,
} from "../../lib/admin-command-schema";
import { gameSchema, type Game } from "../../lib/domain";
import {
  SqlDatabase,
  databaseConfig,
  type DatabaseConfig,
} from "../../lib/sql-database";
import { importDatabase } from "../../lib/import-database";
import { LocalMediaStorage } from "../../lib/media-storage";
import { createMediaStaging, chunkSize } from "../../lib/media-staging";

const snapshot = async (store: TournamentStore) => {
  const rows = [];
  for (const table of [
    "records",
    "entity_refs",
    "audit",
    "undo",
    "revision",
    "commands",
  ])
    rows.push(
      await store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    );
  return JSON.stringify(rows);
};
const game = (id = "game") =>
  gameSchema.parse({
    id,
    home: "al-ittihad",
    away: "stade-malien",
    group: "A",
    date: "2026-10-21T18:00:00+02:00",
    status: "Live",
    quarter: 2,
    clock: 0,
    homeScore: 3,
    periods: [
      { home: 3, away: 0 },
      { home: 0, away: 0 },
    ],
  });

for (const kind of ["sqlite", "libsql"] as const) {
  test(`${kind}: all control commands rollback every side effect and commit/idempotently replay`, async () => {
    const root = mkdtempSync(
      join(process.env.PERSISTENCE_TEST_ROOT || tmpdir(), "road-commands-"),
    );
    const config: DatabaseConfig =
      kind === "sqlite"
        ? { kind, path: join(root, "test.db") }
        : { kind, url: pathToFileURL(join(root, "test.db")).href };
    const repository = createTournamentStore(() => config);
    try {
      for (const action of [
        "score",
        "status",
        "clock",
        "undo",
        "correct",
      ] as const) {
        const beforeGame = game(action);
        await repository.write("games", action, beforeGame, "fixture");
        await repository.db
          .prepare("INSERT INTO undo(game,body) VALUES(?,?)")
          .run(
            action,
            JSON.stringify({
              ...beforeGame,
              homeScore: 2,
              periods: [
                { home: 2, away: 0 },
                { home: 0, away: 0 },
              ],
            }),
          );
        const command = adminCommandSchema.parse({
          action,
          id: action,
          version: 0,
          requestId: randomUUID(),
          ...(action === "score"
            ? { side: "home", points: 2 }
            : action === "clock"
              ? { clock: 100, running: false }
              : action === "status"
                ? { status: "Halftime" }
                : action === "correct"
                  ? {
                      confirmed: true,
                      reason: "Verified score correction",
                      value: {
                        ...beforeGame,
                        homeScore: 4,
                        periods: [
                          { home: 4, away: 0 },
                          { home: 0, away: 0 },
                        ],
                      },
                    }
                  : {}),
        });
        const before = await snapshot(repository);
        // Status/correction fail after the game audit/revision and dependent pulse write.
        const trigger = ["status", "correct"].includes(action)
          ? "CREATE TRIGGER injected BEFORE INSERT ON audit WHEN NEW.kind='pulse' BEGIN SELECT RAISE(ABORT,'injected failure'); END"
          : "CREATE TRIGGER injected BEFORE UPDATE ON revision BEGIN SELECT RAISE(ABORT,'injected failure'); END";
        await repository.db.exec(trigger);
        await assert.rejects(
          applyCommand(command, "admin", repository),
          /injected failure/,
        );
        assert.equal(
          await snapshot(repository),
          before,
          action + " must rollback records/refs/audit/undo/revision/requestId",
        );
        await repository.db.exec("DROP TRIGGER injected");
        const revision = await repository.revision();
        await applyCommand(command, "admin", repository);
        const after = await snapshot(repository);
        const updated = (await repository.get<Game>("games", action))!;
        assert.equal(updated.version, 1);
        assert.equal(
          await repository.revision(),
          revision + (["status", "correct"].includes(action) ? 2 : 1),
        );
        const audit = await repository.db
          .prepare(
            "SELECT * FROM audit WHERE kind='games' AND target=? ORDER BY id DESC LIMIT 1",
          )
          .get(action);
        assert.equal(audit.action, action);
        if (action === "correct") assert.equal(audit.reason, command.reason);
        if (action === "score") assert.equal(updated.homeScore, 5);
        if (action === "undo") assert.equal(updated.homeScore, 2);
        if (action === "status") assert.equal(updated.status, "Halftime");
        if (action === "clock") assert.equal(updated.clock, 100);
        await applyCommand(command, "admin", repository);
        assert.equal(
          await snapshot(repository),
          after,
          "replay must have zero side effects",
        );
        await assert.rejects(
          applyCommand(
            { ...command, reason: "Different command body" },
            "admin",
            repository,
          ),
          /Request ID already used/,
        );
        assert.equal(await snapshot(repository), after);
      }
    } finally {
      await repository.db.close();
      // The parent removes fixtures after native libSQL has released its Windows mappings.
    }
  });

  test(`${kind}: independent instances preserve version conflicts, shared auth/rate limits and concurrent idempotency`, async () => {
    const root = mkdtempSync(
      join(process.env.PERSISTENCE_TEST_ROOT || tmpdir(), "road-concurrency-"),
    );
    const config: DatabaseConfig =
      kind === "sqlite"
        ? { kind, path: join(root, "test.db") }
        : { kind, url: pathToFileURL(join(root, "test.db")).href };
    const first = createTournamentStore(() => config),
      second = createTournamentStore(() => config);
    try {
      await first.write("games", "game", game(), "fixture");
      await second.db.ready();
      const command: AdminCommand = {
        action: "score",
        id: "game",
        version: 0,
        side: "home",
        points: 1,
        requestId: randomUUID(),
      };
      const result = await Promise.allSettled([
        applyCommand(command, "admin", first),
        applyCommand({ ...command, requestId: randomUUID() }, "admin", second),
      ]);
      assert.equal(
        result.filter((row) => row.status === "fulfilled").length,
        1,
      );
      const failed = result.find(
        (row) => row.status === "rejected",
      ) as PromiseRejectedResult;
      assert.ok(failed.reason instanceof ConflictError);
      assert.equal((await first.get<Game>("games", "game"))?.homeScore, 4);
      const next = { ...command, version: 1, requestId: randomUUID() };
      const before = await first.revision();
      await Promise.all([
        applyCommand(next, "admin", first),
        applyCommand(next, "admin", second),
      ]);
      assert.equal(await first.revision(), before + 1);
      assert.equal((await first.get<Game>("games", "game"))?.homeScore, 5);
      await first.provision("test-only-secure-password");
      const token = await first.login("test-only-secure-password");
      assert.ok(token);
      assert.equal(await second.authorize(token), "admin");
      const limits = await Promise.all([
        first.rateLimit("shared", 1),
        second.rateLimit("shared", 1),
      ]);
      assert.equal(limits.filter(Boolean).length, 1);
      await second.revoke(token);
      assert.equal(await first.authorize(token), null);
      assert.equal(
        (await first.db.prepare("PRAGMA foreign_key_check").all()).length,
        0,
      );
    } finally {
      await first.db.close();
      await second.db.close();
      // The parent removes fixtures after native libSQL has released its Windows mappings.
    }
  });
}

test("import preserves source, all rows/IDs/credentials/revision and rejects changed-source or nonempty targets", async () => {
  const root = mkdtempSync(
    join(process.env.PERSISTENCE_TEST_ROOT || tmpdir(), "road-import-test-"),
  );
  const source = join(root, "source.db");
  const original = createTournamentStore(() => ({
    kind: "sqlite",
    path: source,
  }));
  const target = new SqlDatabase(() => ({
    kind: "libsql",
    url: pathToFileURL(join(root, "target.db")).href,
  }));
  try {
    await original.provision("test-only-import-password");
    const token = await original.login("test-only-import-password");
    await original.write("games", "game", game(), "fixture");
    await applyCommand(
      {
        action: "score",
        id: "game",
        version: 0,
        side: "home",
        points: 1,
        requestId: randomUUID(),
      },
      "admin",
      original,
    );
    await original.db.exec(
      "CREATE TABLE future_table(value TEXT); INSERT INTO future_table VALUES('retained')",
    );
    const expected = await snapshot(original);
    await original.db.close();
    const checksum = createHash("sha256")
      .update(readFileSync(source))
      .digest("hex");
    const options = {
      source,
      mediaDirectory: join(root, "source-media"),
      database: target,
      media: new LocalMediaStorage(join(root, "target-media")),
      includeAdmins: true,
      includeSessions: true,
    };
    assert.equal((await importDatabase(options)).status, "imported");
    assert.equal((await importDatabase(options)).status, "already-imported");
    assert.equal(
      createHash("sha256").update(readFileSync(source)).digest("hex"),
      checksum,
    );
    const imported = createTournamentStore(() => ({
      kind: "libsql",
      url: pathToFileURL(join(root, "target.db")).href,
    }));
    try {
      assert.equal(await snapshot(imported), expected);
      assert.equal(await imported.authorize(token!), "admin");
      assert.ok(await imported.login("test-only-import-password"));
      assert.equal(
        (await target.prepare("SELECT value FROM future_table").get()).value,
        "retained",
      );
    } finally {
      await imported.db.close();
    }
    await assert.rejects(
      importDatabase({ ...options, includeSessions: false }),
      /Different source/,
    );
    const nonempty = new SqlDatabase(() => ({
      kind: "sqlite",
      path: join(root, "occupied.db"),
    }));
    try {
      await nonempty.exec("CREATE TABLE occupied(id INTEGER)");
      await assert.rejects(
        importDatabase({ ...options, database: nonempty }),
        /Destination must be empty/,
      );
    } finally {
      await nonempty.close();
    }
  } finally {
    await target.close();
    // The parent removes fixtures after native libSQL has released its Windows mappings.
  }
});

test("staged 5 MB uploads are private, bounded, immutable, owner scoped and completion audit is idempotent", async () => {
  const root = mkdtempSync(
    join(process.env.PERSISTENCE_TEST_ROOT || tmpdir(), "road-stage-"),
  );
  const repository = createTournamentStore(() => ({
    kind: "libsql",
    url: pathToFileURL(join(root, "test.db")).href,
  }));
  const staging = createMediaStaging(repository);
  try {
    const start = await staging.start(
      { name: "large.png", type: "image/png", size: 5242880 },
      "admin",
    );
    await assert.rejects(staging.assemble(start.uploadId, "other"), /missing/);
    await assert.rejects(
      staging.assemble(start.uploadId, "admin"),
      /incomplete/,
    );
    for (let part = 0; part < 10; part++)
      await staging.chunk(
        start.uploadId,
        part,
        new Uint8Array(chunkSize).fill(part),
        "admin",
      );
    await staging.chunk(start.uploadId, 0, new Uint8Array(chunkSize), "admin");
    await assert.rejects(
      staging.chunk(
        start.uploadId,
        0,
        new Uint8Array(chunkSize).fill(20),
        "admin",
      ),
      /conflict/,
    );
    await assert.rejects(
      staging.chunk(start.uploadId, 10, new Uint8Array(chunkSize), "admin"),
      /Invalid/,
    );
    assert.equal(
      (await staging.assemble(start.uploadId, "admin")).file?.size,
      5242880,
    );
    await staging.finish(start.uploadId, "admin", "a".repeat(64) + ".webp", 3);
    await staging.finish(start.uploadId, "admin", "a".repeat(64) + ".webp", 3);
    assert.ok((await staging.assemble(start.uploadId, "admin")).result);
    assert.equal(
      (await repository.db.prepare("SELECT count(*) n FROM media_chunks").get())
        .n,
      0,
    );
    assert.equal(
      (
        await repository.db
          .prepare("SELECT count(*) n FROM audit WHERE kind='media'")
          .get()
      ).n,
      1,
    );
    await repository.db.prepare("UPDATE media_uploads SET expires=0").run();
    await assert.rejects(staging.assemble(start.uploadId, "admin"), /expired/);
  } finally {
    await repository.db.close();
    // The parent removes fixtures after native libSQL has released its Windows mappings.
  }
});

test("Vercel configuration never falls back to writable SQLite or accepts local replicas", () => {
  assert.throws(
    () =>
      databaseConfig({
        NODE_ENV: "production",
        VERCEL: "1",
        DATABASE_PATH: "/tmp/road.db",
      }),
    /TURSO_DATABASE_URL/,
  );
  assert.throws(
    () =>
      databaseConfig({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "file:/var/task/data/road.db",
        TURSO_AUTH_TOKEN: "test",
      }),
    /remote/,
  );
  assert.throws(
    () =>
      databaseConfig({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
      }),
    /TURSO_AUTH_TOKEN/,
  );
});
