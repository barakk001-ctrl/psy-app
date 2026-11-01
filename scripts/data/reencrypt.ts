// Rewrites every encrypted value that isn't under the active key. Only needed
// during a key rotation; see src/lib/crypto.ts and src/lib/reencrypt.ts.
//
//   npm run data:reencrypt                counts and test-decrypts, writes nothing
//   npm run data:reencrypt -- --apply     rewrites
//
// Every old key must stay set until a dry run reports nothing left.

import { reencryptAll } from "@/lib/reencrypt";
import { dbAll } from "@/lib/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const report = await reencryptAll({ apply });
  console.log(apply ? "Done." : "Dry run: nothing was written.");
  console.log("Active key version:", report.activeVersion);
  console.log("On an older key:", report.found);
  console.log("Rewritten:", report.rewritten, "Changed meanwhile, left for the next pass:", report.skipped);
  if (report.failed.length) {
    console.error("Could not be decrypted, left alone:", report.failed);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Re-encryption failed:", err instanceof Error ? err.message.split("\n")[0] : "unknown");
    process.exitCode = 1;
  })
  .finally(() => dbAll.$disconnect());
