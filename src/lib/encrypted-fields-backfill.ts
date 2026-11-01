// Converts rows written before Client.idNumber, Client.generalNotes,
// SessionFile.fileName and InboxMessage.text were encrypted (sensitive-fields.ts).
//
// ON HOLD: not to be run on production until the owner confirms that
// NOTES_ENCRYPTION_KEY is saved outside Railway. Encrypting more data under a key
// that exists in one place raises the cost of losing it. Nothing in the app
// calls this; the only entry is scripts/data/backfill-encrypted-fields.ts, which
// is dry unless told otherwise.
//
// Two separate steps, so the first can be checked and undone by doing nothing:
//   copy:  fills the encrypted column. The plain column stays; reads already
//          prefer the encrypted one.
//   clear: empties the plain column, only where the encrypted value decrypts to
//          exactly the same text. The columns themselves are not dropped.

import { dbAll } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const PAGE = 500;

export type BackfillReport = {
  /** rows whose encrypted column is still empty */
  toCopy: Record<string, number>;
  copied: number;
  /** rows holding both forms */
  toClear: Record<string, number>;
  cleared: number;
  /** encrypted value doesn't match the plain text, or doesn't decrypt: left alone */
  mismatched: string[];
};

/** One plain column and its encrypted partner. `empty` is what "no plain text" looks like. */
type Pair = {
  label: string;
  empty: string | null;
  read(after?: string): Promise<{ id: string; plain: string | null; sealed: string | null }[]>;
  /** Conditional on what was read, so an edit in between isn't overwritten. */
  setSealed(id: string, plain: string, sealed: string): Promise<number>;
  clearPlain(id: string, plain: string): Promise<number>;
};

const pageArgs = (after?: string) => ({
  take: PAGE,
  orderBy: { id: "asc" as const },
  ...(after ? { skip: 1, cursor: { id: after } } : {}),
});

const PAIRS: Pair[] = [
  {
    label: "Client.idNumber",
    empty: null,
    read: async (after) =>
      (await dbAll.client.findMany({ select: { id: true, idNumber: true, idNumberCiphertext: true }, ...pageArgs(after) })).map(
        (r) => ({ id: r.id, plain: r.idNumber, sealed: r.idNumberCiphertext }),
      ),
    setSealed: async (id, plain, sealed) =>
      (await dbAll.client.updateMany({ where: { id, idNumber: plain, idNumberCiphertext: null }, data: { idNumberCiphertext: sealed } })).count,
    clearPlain: async (id, plain) =>
      (await dbAll.client.updateMany({ where: { id, idNumber: plain }, data: { idNumber: null } })).count,
  },
  {
    label: "Client.generalNotes",
    empty: null,
    read: async (after) =>
      (await dbAll.client.findMany({ select: { id: true, generalNotes: true, generalNotesCiphertext: true }, ...pageArgs(after) })).map(
        (r) => ({ id: r.id, plain: r.generalNotes, sealed: r.generalNotesCiphertext }),
      ),
    setSealed: async (id, plain, sealed) =>
      (await dbAll.client.updateMany({ where: { id, generalNotes: plain, generalNotesCiphertext: null }, data: { generalNotesCiphertext: sealed } })).count,
    clearPlain: async (id, plain) =>
      (await dbAll.client.updateMany({ where: { id, generalNotes: plain }, data: { generalNotes: null } })).count,
  },
  {
    label: "SessionFile.fileName",
    empty: "",
    read: async (after) =>
      (await dbAll.sessionFile.findMany({ select: { id: true, fileName: true, fileNameCiphertext: true }, ...pageArgs(after) })).map(
        (r) => ({ id: r.id, plain: r.fileName, sealed: r.fileNameCiphertext }),
      ),
    setSealed: async (id, plain, sealed) =>
      (await dbAll.sessionFile.updateMany({ where: { id, fileName: plain, fileNameCiphertext: null }, data: { fileNameCiphertext: sealed } })).count,
    clearPlain: async (id, plain) =>
      (await dbAll.sessionFile.updateMany({ where: { id, fileName: plain }, data: { fileName: "" } })).count,
  },
  {
    label: "InboxMessage.text",
    empty: "",
    read: async (after) =>
      (await dbAll.inboxMessage.findMany({ select: { id: true, text: true, textCiphertext: true }, ...pageArgs(after) })).map(
        (r) => ({ id: r.id, plain: r.text, sealed: r.textCiphertext }),
      ),
    setSealed: async (id, plain, sealed) =>
      (await dbAll.inboxMessage.updateMany({ where: { id, text: plain, textCiphertext: null }, data: { textCiphertext: sealed } })).count,
    clearPlain: async (id, plain) =>
      (await dbAll.inboxMessage.updateMany({ where: { id, text: plain }, data: { text: "" } })).count,
  },
];

function sameText(sealed: string, plain: string): boolean {
  try {
    return decryptSecret(sealed) === plain;
  } catch {
    return false;
  }
}

/** Dry by default: with neither option it only counts. */
export async function backfillEncryptedFields(
  opts: { copy?: boolean; clear?: boolean } = {},
): Promise<BackfillReport> {
  const report: BackfillReport = { toCopy: {}, copied: 0, toClear: {}, cleared: 0, mismatched: [] };

  for (const pair of PAIRS) {
    const hasPlain = (p: string | null) => p !== null && p !== pair.empty;
    let after: string | undefined;
    for (;;) {
      const rows = await pair.read(after);
      if (rows.length === 0) break;
      for (const r of rows) {
        if (!hasPlain(r.plain)) continue;
        const plain = r.plain as string;
        if (!r.sealed) {
          report.toCopy[pair.label] = (report.toCopy[pair.label] ?? 0) + 1;
          if (opts.copy) report.copied += await pair.setSealed(r.id, plain, encryptSecret(plain));
          continue;
        }
        report.toClear[pair.label] = (report.toClear[pair.label] ?? 0) + 1;
        if (!sameText(r.sealed, plain)) {
          report.mismatched.push(`${pair.label} ${r.id}`);
          continue;
        }
        if (opts.clear) report.cleared += await pair.clearPlain(r.id, plain);
      }
      if (rows.length < PAGE) break;
      after = rows[rows.length - 1].id;
    }
  }
  return report;
}
