import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("SQLite and libSQL persistence integration suite (7 scenarios)", () => {
  const root = mkdtempSync(join(tmpdir(), "road-adapter-suite-"));
  try {
    const env: NodeJS.ProcessEnv = { ...process.env, PERSISTENCE_TEST_ROOT: root };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "--test-reporter=spec",
        "tests/fixtures/persistence-worker.ts",
      ],
      { env, encoding: "utf8", timeout: 120000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /tests 7/);
  } finally {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});
