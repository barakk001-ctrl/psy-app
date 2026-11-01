// Converts rows from before Client.idNumber, Client.generalNotes,
// SessionFile.fileName and InboxMessage.text were encrypted.
// See src/lib/encrypted-fields-backfill.ts. ON HOLD for production until the
// owner confirms NOTES_ENCRYPTION_KEY is saved outside Railway.
//
//   npm run data:backfill                 counts only, writes nothing
//   npm run data:backfill -- --copy       fills the encrypted columns
//   npm run data:backfill -- --clear      empties the plain columns (verified first)
//
// Anything but a dry run also needs CONFIRM_KEY_IS_BACKED_UP=yes in the
// environment, so it can't be started by accident.

import { backfillEncryptedFields } from "@/lib/encrypted-fields-backfill";
import { dbAll } from "@/lib/db";

async function main() {
  const copy = process.argv.includes("--copy");
  const clear = process.argv.includes("--clear");
  if ((copy || clear) && process.env.CONFIRM_KEY_IS_BACKED_UP !== "yes") {
    console.error("Refused: set CONFIRM_KEY_IS_BACKED_UP=yes once NOTES_ENCRYPTION_KEY is saved outside Railway.");
    process.exitCode = 1;
    return;
  }
  const report = await backfillEncryptedFields({ copy, clear });
  console.log(copy || clear ? "Done." : "Dry run: nothing was written.");
  console.log("Still plain, no encrypted copy:", report.toCopy);
  console.log("Encrypted copies written:", report.copied);
  console.log("Holding both forms:", report.toClear);
  console.log("Plain text cleared:", report.cleared);
  if (report.mismatched.length) {
    console.error("Left alone, encrypted value doesn't match:", report.mismatched);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message.split("\n")[0] : "unknown");
    process.exitCode = 1;
  })
  .finally(() => dbAll.$disconnect());
