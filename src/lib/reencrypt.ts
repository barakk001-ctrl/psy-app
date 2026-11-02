// The re-encryption job: rewrites every encrypted value that isn't under the
// active key (crypto.ts explains key versions). Nothing runs it automatically;
// it is started by hand with scripts/data/reencrypt.ts. Dry by default.
//
// Safe to stop and run again: it only touches values on an older key, and each
// write is conditional on the value it read, so an edit made while it runs wins
// and is simply left for the next pass (it is already under the active key).
// Every old key must stay set until it reports nothing left.

import { dbAll } from "@/lib/db";
import {
  activeKeyVersion,
  decryptBuffer,
  decryptNote,
  decryptSecret,
  encryptBuffer,
  encryptNote,
  encryptSecret,
  keyVersionOf,
} from "@/lib/crypto";

const PAGE = 200;

export type ReencryptReport = {
  activeVersion: number;
  /** values on an older key, per field */
  found: Record<string, number>;
  rewritten: number;
  /** changed while the job ran: picked up by the next pass if still old */
  skipped: number;
  /** could not be decrypted: reported, never overwritten */
  failed: string[];
};

type Run = { apply: boolean; report: ReencryptReport; active: number };

const isOld = (run: Run, value: string | null | undefined) =>
  !!value && keyVersionOf(value) !== run.active;

function tally(run: Run, field: string) {
  run.report.found[field] = (run.report.found[field] ?? 0) + 1;
}

/** Walks a table by id, a page at a time. */
async function eachPage<T extends { id: string }>(
  read: (after?: string) => Promise<T[]>,
  handle: (rows: T[]) => Promise<void>,
) {
  let after: string | undefined;
  for (;;) {
    const rows = await read(after);
    if (rows.length === 0) return;
    await handle(rows);
    if (rows.length < PAGE) return;
    after = rows[rows.length - 1].id;
  }
}

const pageArgs = (after?: string) => ({
  take: PAGE,
  orderBy: { id: "asc" as const },
  ...(after ? { skip: 1, cursor: { id: after } } : {}),
});

/** One packed column (iv:tag:ciphertext) of any table. */
async function packedField<T extends { id: string }>(
  run: Run,
  label: string,
  read: (after?: string) => Promise<T[]>,
  value: (row: T) => string | null,
  write: (row: T, old: string, next: string) => Promise<number>,
) {
  await eachPage(read, async (rows) => {
    for (const row of rows) {
      const old = value(row);
      if (!old || !isOld(run, old)) continue;
      tally(run, label);
      try {
        const next = encryptSecret(decryptSecret(old));
        if (!run.apply) continue;
        if ((await write(row, old, next)) === 1) run.report.rewritten++;
        else run.report.skipped++;
      } catch {
        run.report.failed.push(`${label} ${row.id}`);
      }
    }
  });
}

async function notes(run: Run) {
  await eachPage(
    (after) =>
      dbAll.sessionNote.findMany({
        select: { id: true, contentIv: true, contentTag: true, contentCiphertext: true },
        ...pageArgs(after),
      }),
    async (rows) => {
      for (const r of rows) {
        if (!isOld(run, r.contentIv)) continue;
        tally(run, "SessionNote.content");
        try {
          const next = encryptNote(decryptNote(r));
          if (!run.apply) continue;
          const { count } = await dbAll.sessionNote.updateMany({
            where: { id: r.id, contentIv: r.contentIv },
            data: next,
          });
          if (count === 1) run.report.rewritten++;
          else run.report.skipped++;
        } catch {
          run.report.failed.push(`SessionNote ${r.id}`);
        }
      }
    },
  );
}

async function binaries(run: Run) {
  // Bytes are read one row at a time: only the IVs are paged
  await eachPage(
    (after) => dbAll.sessionFile.findMany({ select: { id: true, dataIv: true }, ...pageArgs(after) }),
    async (rows) => {
      for (const r of rows) {
        if (!isOld(run, r.dataIv)) continue;
        tally(run, "SessionFile.data");
        try {
          const full = await dbAll.sessionFile.findUniqueOrThrow({
            where: { id: r.id },
            select: { dataCiphertext: true, dataIv: true, dataTag: true },
          });
          const plain = decryptBuffer({
            ciphertext: Buffer.from(full.dataCiphertext),
            iv: full.dataIv,
            tag: full.dataTag,
          });
          if (!run.apply) continue;
          const next = encryptBuffer(plain);
          const { count } = await dbAll.sessionFile.updateMany({
            where: { id: r.id, dataIv: full.dataIv },
            data: { dataCiphertext: new Uint8Array(next.ciphertext), dataIv: next.iv, dataTag: next.tag },
          });
          if (count === 1) run.report.rewritten++;
          else run.report.skipped++;
        } catch {
          run.report.failed.push(`SessionFile ${r.id}`);
        }
      }
    },
  );

  let afterExpense: string | undefined;
  for (;;) {
    const rows: { expenseId: string; iv: string }[] = await dbAll.expenseBlob.findMany({
      select: { expenseId: true, iv: true },
      take: PAGE,
      orderBy: { expenseId: "asc" },
      ...(afterExpense ? { skip: 1, cursor: { expenseId: afterExpense } } : {}),
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      if (!isOld(run, r.iv)) continue;
      tally(run, "ExpenseBlob.data");
      try {
        const full = await dbAll.expenseBlob.findUniqueOrThrow({ where: { expenseId: r.expenseId } });
        const plain = decryptBuffer({ ciphertext: Buffer.from(full.ciphertext), iv: full.iv, tag: full.tag });
        if (!run.apply) continue;
        const next = encryptBuffer(plain);
        const { count } = await dbAll.expenseBlob.updateMany({
          where: { expenseId: r.expenseId, iv: full.iv },
          data: { ciphertext: new Uint8Array(next.ciphertext), iv: next.iv, tag: next.tag },
        });
        if (count === 1) run.report.rewritten++;
        else run.report.skipped++;
      } catch {
        run.report.failed.push(`ExpenseBlob ${r.expenseId}`);
      }
    }
    if (rows.length < PAGE) break;
    afterExpense = rows[rows.length - 1].expenseId;
  }

  let after: string | undefined;
  for (;;) {
    const rows: { documentId: string; iv: string }[] = await dbAll.clientDocumentBlob.findMany({
      select: { documentId: true, iv: true },
      take: PAGE,
      orderBy: { documentId: "asc" },
      ...(after ? { skip: 1, cursor: { documentId: after } } : {}),
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      if (!isOld(run, r.iv)) continue;
      tally(run, "ClientDocumentBlob.data");
      try {
        const full = await dbAll.clientDocumentBlob.findUniqueOrThrow({ where: { documentId: r.documentId } });
        const plain = decryptBuffer({ ciphertext: Buffer.from(full.ciphertext), iv: full.iv, tag: full.tag });
        if (!run.apply) continue;
        const next = encryptBuffer(plain);
        const { count } = await dbAll.clientDocumentBlob.updateMany({
          where: { documentId: r.documentId, iv: full.iv },
          data: { ciphertext: new Uint8Array(next.ciphertext), iv: next.iv, tag: next.tag },
        });
        if (count === 1) run.report.rewritten++;
        else run.report.skipped++;
      } catch {
        run.report.failed.push(`ClientDocumentBlob ${r.documentId}`);
      }
    }
    if (rows.length < PAGE) break;
    after = rows[rows.length - 1].documentId;
  }

  await eachPage(
    (after2) =>
      dbAll.supportRequest.findMany({
        where: { attachmentIv: { not: null } },
        select: { id: true, attachmentIv: true },
        ...pageArgs(after2),
      }),
    async (rows) => {
      for (const r of rows) {
        if (!isOld(run, r.attachmentIv)) continue;
        tally(run, "SupportRequest.attachment");
        try {
          const full = await dbAll.supportRequest.findUniqueOrThrow({
            where: { id: r.id },
            select: { attachmentCiphertext: true, attachmentIv: true, attachmentTag: true },
          });
          const plain = decryptBuffer({
            ciphertext: Buffer.from(full.attachmentCiphertext!),
            iv: full.attachmentIv!,
            tag: full.attachmentTag!,
          });
          if (!run.apply) continue;
          const next = encryptBuffer(plain);
          const { count } = await dbAll.supportRequest.updateMany({
            where: { id: r.id, attachmentIv: full.attachmentIv },
            data: { attachmentCiphertext: new Uint8Array(next.ciphertext), attachmentIv: next.iv, attachmentTag: next.tag },
          });
          if (count === 1) run.report.rewritten++;
          else run.report.skipped++;
        } catch {
          run.report.failed.push(`SupportRequest ${r.id}`);
        }
      }
    },
  );
}

async function packedColumns(run: Run) {
  const update = (result: Promise<{ count: number }>) => result.then((r) => r.count);

  await packedField(
    run,
    "User.morningApiSecret",
    (after) => dbAll.user.findMany({ select: { id: true, morningApiSecret: true }, ...pageArgs(after) }),
    (r) => r.morningApiSecret,
    (r, old, next) =>
      update(dbAll.user.updateMany({ where: { id: r.id, morningApiSecret: old }, data: { morningApiSecret: next } })),
  );
  await packedField(
    run,
    "User.totpSecret",
    (after) => dbAll.user.findMany({ select: { id: true, totpSecret: true }, ...pageArgs(after) }),
    (r) => r.totpSecret,
    (r, old, next) =>
      update(dbAll.user.updateMany({ where: { id: r.id, totpSecret: old }, data: { totpSecret: next } })),
  );
  await packedField(
    run,
    "Client.idNumberCiphertext",
    (after) => dbAll.client.findMany({ select: { id: true, idNumberCiphertext: true }, ...pageArgs(after) }),
    (r) => r.idNumberCiphertext,
    (r, old, next) =>
      update(dbAll.client.updateMany({ where: { id: r.id, idNumberCiphertext: old }, data: { idNumberCiphertext: next } })),
  );
  await packedField(
    run,
    "Client.generalNotesCiphertext",
    (after) => dbAll.client.findMany({ select: { id: true, generalNotesCiphertext: true }, ...pageArgs(after) }),
    (r) => r.generalNotesCiphertext,
    (r, old, next) =>
      update(dbAll.client.updateMany({ where: { id: r.id, generalNotesCiphertext: old }, data: { generalNotesCiphertext: next } })),
  );
  await packedField(
    run,
    "SessionFile.fileNameCiphertext",
    (after) => dbAll.sessionFile.findMany({ select: { id: true, fileNameCiphertext: true }, ...pageArgs(after) }),
    (r) => r.fileNameCiphertext,
    (r, old, next) =>
      update(dbAll.sessionFile.updateMany({ where: { id: r.id, fileNameCiphertext: old }, data: { fileNameCiphertext: next } })),
  );
  await packedField(
    run,
    "Expense.nameCiphertext",
    (after) => dbAll.expense.findMany({ select: { id: true, nameCiphertext: true }, ...pageArgs(after) }),
    (r) => r.nameCiphertext,
    (r, old, next) =>
      update(dbAll.expense.updateMany({ where: { id: r.id, nameCiphertext: old }, data: { nameCiphertext: next } })),
  );
  await packedField(
    run,
    "ClientDocument.nameCiphertext",
    (after) => dbAll.clientDocument.findMany({ select: { id: true, nameCiphertext: true }, ...pageArgs(after) }),
    (r) => r.nameCiphertext,
    (r, old, next) =>
      update(dbAll.clientDocument.updateMany({ where: { id: r.id, nameCiphertext: old }, data: { nameCiphertext: next } })),
  );
  await packedField(
    run,
    "ClientDocument.descriptionCiphertext",
    (after) => dbAll.clientDocument.findMany({ select: { id: true, descriptionCiphertext: true }, ...pageArgs(after) }),
    (r) => r.descriptionCiphertext,
    (r, old, next) =>
      update(dbAll.clientDocument.updateMany({ where: { id: r.id, descriptionCiphertext: old }, data: { descriptionCiphertext: next } })),
  );
  await packedField(
    run,
    "WaitlistEntry.notesCiphertext",
    (after) => dbAll.waitlistEntry.findMany({ select: { id: true, notesCiphertext: true }, ...pageArgs(after) }),
    (r) => r.notesCiphertext,
    (r, old, next) =>
      update(dbAll.waitlistEntry.updateMany({ where: { id: r.id, notesCiphertext: old }, data: { notesCiphertext: next } })),
  );
  await packedField(
    run,
    "InboxMessage.textCiphertext",
    (after) => dbAll.inboxMessage.findMany({ select: { id: true, textCiphertext: true }, ...pageArgs(after) }),
    (r) => r.textCiphertext,
    (r, old, next) =>
      update(dbAll.inboxMessage.updateMany({ where: { id: r.id, textCiphertext: old }, data: { textCiphertext: next } })),
  );
}

/** With `apply: false` (the default) it counts and test-decrypts, and writes nothing. */
export async function reencryptAll(opts: { apply?: boolean } = {}): Promise<ReencryptReport> {
  const active = activeKeyVersion();
  const report: ReencryptReport = { activeVersion: active, found: {}, rewritten: 0, skipped: 0, failed: [] };
  const run: Run = { apply: !!opts.apply, report, active };
  await notes(run);
  await binaries(run);
  await packedColumns(run);
  return report;
}
