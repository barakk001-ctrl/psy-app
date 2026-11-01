// Client.idNumber, Client.generalNotes, SessionFile.fileName and
// InboxMessage.text are moving from plain columns to encrypted ones, in the
// expand-only way: every new write goes to the *Ciphertext column and leaves the
// plain column empty, and every read takes the ciphertext when there is one and
// the plain column otherwise. Existing rows stay plain until the backfill runs
// (encrypted-fields-backfill.ts, off by default, see its header). The plain
// columns aren't dropped.
//
// Nothing searches or sorts on these fields (they are read for display only),
// so moving them changes no query. Always read them through these helpers.

import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** The encrypted value of a text field; an empty one stays empty. */
export function sealText(value: string | null | undefined): string | null {
  return value ? encryptSecret(value) : null;
}

/**
 * Either form. A value that can't be decrypted reads as the plain column, or as
 * nothing, so one damaged row doesn't take a page down.
 */
export function openText(
  ciphertext: string | null | undefined,
  plain: string | null | undefined,
): string | null {
  if (ciphertext) {
    try {
      return decryptSecret(ciphertext);
    } catch {
      console.error("Encrypted field could not be read");
    }
  }
  return plain || null;
}

type ClientFields = {
  idNumber: string | null;
  idNumberCiphertext: string | null;
  generalNotes?: string | null;
  generalNotesCiphertext?: string | null;
};

export const clientIdNumber = (c: Pick<ClientFields, "idNumber" | "idNumberCiphertext">) =>
  openText(c.idNumberCiphertext, c.idNumber);

export const clientGeneralNotes = (c: {
  generalNotes: string | null;
  generalNotesCiphertext: string | null;
}) => openText(c.generalNotesCiphertext, c.generalNotes);

/** What a client save writes for the two fields. */
export function sealClientFields(input: { idNumber?: string | null; generalNotes?: string | null }) {
  return {
    idNumber: null,
    idNumberCiphertext: sealText(input.idNumber),
    generalNotes: null,
    generalNotesCiphertext: sealText(input.generalNotes),
  };
}

export const sessionFileName = (f: { fileName: string; fileNameCiphertext: string | null }) =>
  openText(f.fileNameCiphertext, f.fileName) ?? "קובץ";

/** The two columns are NOT NULL, so the plain one holds "" (expand-only: no column change). */
export const sealFileName = (name: string) => ({ fileName: "", fileNameCiphertext: sealText(name) });

export const inboxText = (m: { text: string; textCiphertext: string | null }) =>
  openText(m.textCiphertext, m.text) ?? "";

export const sealInboxText = (text: string) => ({ text: "", textCiphertext: sealText(text) });
