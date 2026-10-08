import { formatReport, runDryRun } from "../lib/providers/fiba/sync";

// Phase 1: dry run only. This script never imports the store or opens a database.
try {
  console.log(formatReport(await runDryRun()));
} catch (error) {
  console.error(
    `FIBA dry run failed closed — nothing was changed.\n${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
