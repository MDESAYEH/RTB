import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("historical SQLite seed is idempotent and leaves tournament records and revision unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "club-isolation-"));
  try {
    const code = `import assert from 'node:assert/strict';
      const {db,list,revision}=await import('./lib/store.ts');
      const before=JSON.stringify(await db.prepare('SELECT * FROM records ORDER BY kind,id').all());
      const rev=await revision();
      const {clubProvider}=await import('./lib/club-repository.ts');
      assert.equal((await clubProvider.getProfile('energie-bbc')).id,'energie-bc');
      assert.equal((await db.prepare('SELECT count(*) AS n FROM club_profiles').get()).n,10);
      assert.equal((await clubProvider.getProfile('as-douanes-burkina')).countryCode,'BF');
      assert.equal(JSON.stringify(await db.prepare('SELECT * FROM records ORDER BY kind,id').all()),before);
      assert.equal(await revision(),rev);await db.close();`;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", code],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: join(dir, "test.db") },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
