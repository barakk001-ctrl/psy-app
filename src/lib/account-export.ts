// The full account export (Settings → "הורדת כל הנתונים"): one ZIP with
// everything a practice holds, in the clear. Formats: account-export-format.ts.
//
// Streamed, so a large practice doesn't need its files in memory: rows are read
// a page at a time and each file is loaded, decrypted and released on its turn.
// The list of entries is made up front (ids and names only); yazl opens an
// entry's stream only when it reaches it, and output back-pressure pauses the
// reading. It reads through `dbAll`, so clients in the recycle bin are included.
// Every query is scoped by userId.

import crypto from "node:crypto";
import { Readable, finished } from "node:stream";
import yazl from "yazl";
import { dbAll } from "@/lib/db";
import { decryptBuffer, decryptNote, decryptSecret } from "@/lib/crypto";
import { PAYMENT_METHOD_LABELS } from "@/lib/income";
import { isUnissuedDocument } from "@/lib/billing-docs";
import { expenseDocTypeLabel } from "@/lib/expenses";
import { clientGeneralNotes, clientIdNumber, inboxText, sessionFileName } from "@/lib/sensitive-fields";
import { toZonedDateTimeLocal } from "@/lib/timezone";
import {
  CSV_BOM,
  INVOICE_STATUS_LABELS,
  README_TEXT,
  SESSION_PAYMENT_LABELS,
  SESSION_STATUS_LABELS,
  clientFolder,
  csvLine,
  pathAllocator,
  safeFileName,
} from "@/lib/account-export-format";

const PAGE = 500;

export const EXPORT_GRANT_TTL_MS = 5 * 60_000;
/** Downloads per account per hour (the re-check counts them). */
export const EXPORT_RATE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };
/** Downloads running at once in this process: each holds a database connection busy. */
export const MAX_CONCURRENT_EXPORTS = 2;

// ── The one-time grant the re-check leaves for the download ─────────────────

const hashGrant = (grant: string) => crypto.createHash("sha256").update(grant).digest("hex");

export async function createExportGrant(userId: string, now = new Date()): Promise<string> {
  const grant = crypto.randomBytes(32).toString("base64url");
  await dbAll.user.update({
    where: { id: userId },
    data: {
      exportGrantHash: hashGrant(grant),
      exportGrantExpiresAt: new Date(now.getTime() + EXPORT_GRANT_TTL_MS),
    },
  });
  return grant;
}

/** True once for a live grant of this account: the write is what spends it. */
export async function consumeExportGrant(userId: string, grant: string, now = new Date()): Promise<boolean> {
  const { count } = await dbAll.user.updateMany({
    where: { id: userId, exportGrantHash: hashGrant(grant), exportGrantExpiresAt: { gt: now } },
    data: { exportGrantHash: null, exportGrantExpiresAt: null },
  });
  return count === 1;
}

// ── Running exports ─────────────────────────────────────────────────────────

const running = new Set<string>();

/** A release function, or null when this account's export or too many others are running. */
export function tryStartExport(userId: string): (() => void) | null {
  if (running.has(userId) || running.size >= MAX_CONCURRENT_EXPORTS) return null;
  running.add(userId);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    running.delete(userId);
  };
}

// ── What goes in ────────────────────────────────────────────────────────────

export type ExportEntry = {
  path: string;
  /** Text compresses; PDFs and photos are already compressed. */
  compress: boolean;
  body(): AsyncGenerator<Buffer>;
};

const clock = (d: Date | null | undefined) => (d ? toZonedDateTimeLocal(d).replace("T", " ") : "");
const day = (d: Date | null | undefined) => (d ? toZonedDateTimeLocal(d).slice(0, 10) : "");
const method = (m: string | null | undefined) => (m ? (PAYMENT_METHOD_LABELS[m] ?? m) : "");

/** Reads a table a page at a time; `read` gets the id to continue after. */
async function* paged<T extends { id: string }>(
  read: (cursor: { skip: 1; cursor: { id: string } } | object) => Promise<T[]>,
): AsyncGenerator<T[]> {
  let after: string | null = null;
  for (;;) {
    const rows: T[] = await read(after ? { skip: 1, cursor: { id: after } } : {});
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < PAGE) return;
    after = rows[rows.length - 1].id;
  }
}

const orderPage = { take: PAGE, orderBy: { id: "asc" as const } };

const NOTES_PAGE = 100;

/** A client's noted meetings in time order, a page after `after`. */
function notedSessions(userId: string, clientId: string, after: { startsAt: Date; id: string } | null) {
  return dbAll.session.findMany({
    where: {
      userId,
      clientId,
      note: { isNot: null },
      ...(after
        ? {
            OR: [
              { startsAt: { gt: after.startsAt } },
              { startsAt: after.startsAt, id: { gt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: NOTES_PAGE,
    select: { id: true, startsAt: true, treatmentType: true, note: true },
  });
}
type NotedSession = Awaited<ReturnType<typeof notedSessions>>[number];

type Tally = { counts: Record<string, number>; problems: string[] };

function csvEntry<T extends { id: string }>(
  tally: Tally,
  path: string,
  headers: string[],
  pages: () => AsyncGenerator<T[]>,
  line: (row: T) => unknown[],
): ExportEntry {
  return {
    path,
    compress: true,
    async *body() {
      yield Buffer.from(CSV_BOM + csvLine(headers), "utf8");
      let n = 0;
      for await (const rows of pages()) {
        n += rows.length;
        yield Buffer.from(rows.map((r) => csvLine(line(r))).join(""), "utf8");
      }
      tally.counts[path] = n;
    },
  };
}

function textEntry(path: string, text: () => string): ExportEntry {
  return {
    path,
    compress: true,
    async *body() {
      yield Buffer.from(text(), "utf8");
    },
  };
}

function fileEntry(tally: Tally, path: string, load: () => Promise<Buffer | null>): ExportEntry {
  return {
    path,
    compress: false,
    async *body() {
      let bytes: Buffer | null = null;
      try {
        bytes = await load();
      } catch {
        // A file that can't be decrypted must not lose the rest of the export
      }
      if (bytes) yield bytes;
      else tally.problems.push(`לא ניתן היה לקרוא: ${path}`);
    },
  };
}

/** Every entry of this account's export, nothing read yet beyond ids and names. */
export async function buildExportEntries(userId: string): Promise<ExportEntry[]> {
  const tally: Tally = { counts: {}, problems: [] };
  const mine = { userId };
  const place = pathAllocator();

  const account = await dbAll.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      businessName: true,
      businessId: true,
      address: true,
      brandName: true,
      logoUrl: true,
      defaultRate: true,
      currency: true,
      timezone: true,
      defaultSessionMinutes: true,
      vatLiable: true,
      agreementVersion: true,
      agreementAcceptedAt: true,
      trialEndsAt: true,
      subscriptionPlan: true,
      subscriptionEndsAt: true,
      createdAt: true,
    },
  });

  // Client names, for the tables and the folders
  const clients = new Map<string, { name: string; folder: string }>();
  for await (const rows of paged((c) =>
    dbAll.client.findMany({
      where: mine,
      select: { id: true, firstName: true, lastName: true },
      ...orderPage,
      ...c,
    }),
  )) {
    for (const c of rows) {
      clients.set(c.id, { name: `${c.firstName} ${c.lastName}`.trim(), folder: clientFolder(c) });
    }
  }
  const clientName = (id: string | null) => (id ? (clients.get(id)?.name ?? "") : "");
  const folder = (id: string) => clients.get(id)?.folder ?? id;

  const { logoUrl, ...profile } = account;
  const entries: ExportEntry[] = [
    textEntry("קראו אותי.txt", () => README_TEXT),
    textEntry("חשבון.json", () => `${JSON.stringify(profile, null, 2)}\n`),
  ];

  const logo = logoUrl?.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (logo) {
    entries.push({
      path: `לוגו.${logo[1].replace("jpeg", "jpg")}`,
      compress: false,
      async *body() {
        yield Buffer.from(logo[2], "base64");
      },
    });
  }

  entries.push(
    csvEntry(
      tally,
      "לקוחות.csv",
      ["מזהה", "שם פרטי", "שם משפחה", "ת.ז", "אימייל", "טלפון", "תאריך לידה", "כתובת", "תאריך קליטה", "סטטוס", "מחיר לפגישה", "סוג טיפול", "הערות כלליות", "נוצר", "נמחק/ה בתאריך"],
      () => paged((c) => dbAll.client.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [
        r.id,
        r.firstName,
        r.lastName,
        clientIdNumber(r),
        r.email,
        r.phone,
        day(r.dateOfBirth),
        r.address,
        day(r.intakeDate),
        r.status === "ACTIVE" ? "פעיל" : "לא פעיל",
        r.defaultRate,
        r.treatmentType,
        clientGeneralNotes(r),
        clock(r.createdAt),
        clock(r.deletedAt),
      ],
    ),
    csvEntry(
      tally,
      "פגישות.csv",
      ["מזהה", "לקוח/ה", "התחלה", "סיום", "סטטוס", "סוג טיפול", "מיקום", "קישור למפגש", "מחיר", "מצב תשלום", "אמצעי תשלום", "סכום ששולם", "הערת תשלום", "חשבונית מס", "קבלה", "חשבונית מס-קבלה"],
      () => paged((c) => dbAll.session.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [
        r.id,
        clientName(r.clientId),
        clock(r.startsAt),
        clock(r.endsAt),
        SESSION_STATUS_LABELS[r.status] ?? r.status,
        r.treatmentType,
        r.location,
        r.meetingUrl,
        r.rate,
        r.paymentStatus ? (SESSION_PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus) : "",
        method(r.paymentMethod),
        r.paidAmount,
        r.paymentNote,
        r.morningDocNumber,
        r.morningReceiptNumber,
        r.morningInvoiceReceiptNumber,
      ],
    ),
  );

  const notesPages = () =>
    paged((c) =>
      dbAll.sessionNote.findMany({
        where: { session: mine },
        include: { session: { select: { startsAt: true, treatmentType: true } } },
        ...orderPage,
        ...c,
      }),
    );
  const noteText = (path: string, r: Parameters<typeof decryptNote>[0] & { id: string }) => {
    try {
      return decryptNote(r);
    } catch {
      tally.problems.push(`סיכום שלא ניתן היה לפענח (${path}): ${r.id}`);
      return "(שגיאה בפענוח הסיכום)";
    }
  };

  entries.push(
    csvEntry(
      tally,
      "סיכומים.csv",
      ["מזהה", "לקוח/ה", "מועד הפגישה", "סוג טיפול", "הסיכום", "עודכן"],
      notesPages,
      (r) => [
        r.id,
        clientName(r.clientId),
        clock(r.session.startsAt),
        r.session.treatmentType,
        noteText("סיכומים.csv", r),
        clock(r.updatedAt),
      ],
    ),
  );

  // Each client's summaries as one text file, oldest first
  const withNotes = await dbAll.sessionNote.findMany({
    where: { session: mine },
    distinct: ["clientId"],
    select: { clientId: true },
  });
  for (const { clientId } of withNotes) {
    const path = place(`סיכומים/${folder(clientId)}.txt`);
    entries.push({
      path,
      compress: true,
      async *body() {
        yield Buffer.from(`${CSV_BOM}סיכומי פגישות: ${clientName(clientId)}\r\n\r\n`, "utf8");
        let after: { startsAt: Date; id: string } | null = null;
        for (;;) {
          const rows: NotedSession[] = await notedSessions(userId, clientId, after);
          if (rows.length === 0) return;
          let out = "";
          for (const s of rows) {
            out += `--- ${clock(s.startsAt)} · ${s.treatmentType} ---
${noteText(path, s.note!)}

`;
          }
          yield Buffer.from(out, "utf8");
          if (rows.length < NOTES_PAGE) return;
          after = rows[rows.length - 1];
        }
      },
    });
  }

  entries.push(
    csvEntry(
      tally,
      "תשלומים.csv",
      ["מזהה", "מקור", "לקוח/ה", "תאריך", "סכום", "אמצעי תשלום", "אסמכתה", "הערות", "מספר מסמך", "מסמך שטרם הופק"],
      () =>
        (async function* () {
          // Recorded on invoices…
          for await (const rows of paged((c) =>
            dbAll.payment.findMany({
              where: { invoice: mine },
              include: {
                invoice: {
                  select: { clientId: true, number: true, docType: true, morningDocId: true, morningDocNumber: true },
                },
              },
              ...orderPage,
              ...c,
            }),
          )) {
            yield rows.map((r) => ({
              id: r.id,
              source: "חשבונית",
              client: clientName(r.invoice.clientId),
              at: clock(r.paidAt),
              amount: r.amount as unknown,
              how: method(r.method),
              reference: r.reference,
              notes: r.notes,
              doc: r.invoice.number as unknown,
              // Kept, as everything is, but this line isn't income until it's issued
              unissued: isUnissuedDocument(r.invoice) ? "כן" : "",
            }));
          }
          // …and on meetings (documents issued elsewhere, numbers typed on the meeting)
          for await (const rows of paged((c) =>
            dbAll.session.findMany({
              where: { ...mine, paymentStatus: "PAID" },
              ...orderPage,
              ...c,
            }),
          )) {
            yield rows.map((r) => ({
              id: r.id,
              source: "פגישה",
              client: clientName(r.clientId),
              at: clock(r.startsAt),
              amount: (r.paidAmount ?? r.rate) as unknown,
              how: method(r.paymentMethod),
              reference: null,
              notes: r.paymentNote,
              doc: (r.morningReceiptNumber ?? r.morningInvoiceReceiptNumber ?? r.morningDocNumber) as unknown,
              unissued: "",
            }));
          }
        })(),
      (r) => [r.id, r.source, r.client, r.at, r.amount, r.how, r.reference, r.notes, r.doc, r.unissued],
    ),
    csvEntry(
      tally,
      "חשבוניות ומסמכים.csv",
      ["מזהה", "מספר", "סוג מסמך", "לקוח/ה", "שם על המסמך", "מספר זיהוי על המסמך", "תאריך", "תאריך לתשלום", "סטטוס", "סכום ביניים", "סה״כ", "שולם", "מספר המסמך שהופק", "קישור למסמך", "תיאור", "הערות", "מטבע", "שפה", "סוג מע״מ", "עיגול", "מייל למשלוח", "פגישות שסומנו בטיוטה"],
      () => paged((c) => dbAll.invoice.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [
        r.id,
        r.number,
        r.docType,
        clientName(r.clientId),
        r.docClientName,
        r.docClientTaxId,
        day(r.issueDate),
        day(r.dueDate),
        INVOICE_STATUS_LABELS[r.status] ?? r.status,
        r.subtotal,
        r.total,
        r.amountPaid,
        r.morningDocNumber,
        r.morningDocUrl,
        r.description,
        r.notes,
        r.currency,
        r.lang,
        r.vatType,
        r.rounding ? "כן" : "",
        r.docClientEmail,
        r.draftSessionIds.join(" "),
      ],
    ),
    csvEntry(
      tally,
      "הוצאות.csv",
      ["מזהה", "סטטוס", "סוג מסמך", "תאריך", "ספק", "מספר מסמך", "סכום", "מע״מ מתוך הסכום"],
      () => paged((c) => dbAll.expense.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [
        r.id,
        r.status === "APPROVED" ? "מאושר" : "טיוטה",
        expenseDocTypeLabel(r.docType),
        day(r.docDate),
        r.supplier,
        r.docNumber,
        r.amount,
        r.vatAmount,
      ],
    ),
    csvEntry(
      tally,
      "שורות חשבונית.csv",
      ["מזהה", "מספר מסמך", "תיאור", "כמות", "מחיר ליחידה", "סכום", "מזהה פגישה", "שיוך פנימי בלבד"],
      () =>
        paged((c) =>
          dbAll.invoiceItem.findMany({
            where: { invoice: mine },
            include: { invoice: { select: { number: true } } },
            ...orderPage,
            ...c,
          }),
        ),
      (r) => [r.id, r.invoice.number, r.description, r.quantity, r.unitPrice, r.amount, r.sessionId, r.linkOnly ? "כן" : ""],
    ),
    csvEntry(
      tally,
      "מסמכים שיובאו.csv",
      ["מזהה", "מספר", "סוג", "תאריך", "סכום", "תיאור", "לקוח/ה במסמך", "לקוח/ה", "קישור"],
      () => paged((c) => dbAll.morningDocument.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, r.number, r.docType, day(r.docDate), r.amount, r.description, r.morningClientName, clientName(r.clientId), r.url],
    ),
    csvEntry(
      tally,
      "רשימת המתנה.csv",
      ["מזהה", "שם", "טלפון", "הערות", "נוסף"],
      () => paged((c) => dbAll.waitlistEntry.findMany({ where: mine, ...orderPage, ...c })),
      (r) => {
        let notes = "";
        try {
          notes = r.notesCiphertext ? decryptSecret(r.notesCiphertext) : "";
        } catch {
          tally.problems.push(`הערה ברשימת ההמתנה שלא ניתן היה לפענח: ${r.id}`);
        }
        return [r.id, r.fullName, r.phone, notes, clock(r.createdAt)];
      },
    ),
    csvEntry(
      tally,
      "משימות.csv",
      ["מזהה", "משימה", "בוצעה", "נוספה"],
      () => paged((c) => dbAll.todo.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, r.text, r.done ? "כן" : "לא", clock(r.createdAt)],
    ),
    csvEntry(
      tally,
      "סוגי מפגשים.csv",
      ["מזהה", "שם", "צבע"],
      () => paged((c) => dbAll.meetingType.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, r.name, r.color],
    ),
    csvEntry(
      tally,
      "הודעות נכנסות.csv",
      ["מזהה", "הודעה", "טופלה", "התקבלה"],
      () => paged((c) => dbAll.inboxMessage.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, inboxText(r), r.processed ? "כן" : "לא", clock(r.createdAt)],
    ),
    csvEntry(
      tally,
      "פניות תמיכה.csv",
      ["מזהה", "נושא", "תוכן", "סטטוס", "נשלחה", "צילום מסך"],
      () =>
        paged((c) =>
          dbAll.supportRequest.findMany({
            where: mine,
            select: { id: true, subject: true, message: true, status: true, createdAt: true, attachmentName: true },
            ...orderPage,
            ...c,
          }),
        ),
      (r) => [r.id, r.subject, r.message, r.status, clock(r.createdAt), r.attachmentName],
    ),
    csvEntry(
      tally,
      "יומן גישה.csv",
      ["מזהה", "פעולה", "מזהה פגישה", "מזהה לקוח/ה", "מזהה מסמך", "מועד"],
      () => paged((c) => dbAll.auditLog.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, r.action, r.sessionId, r.clientId, r.documentId, clock(r.createdAt)],
    ),
    csvEntry(
      tally,
      "תשלומי מנוי.csv",
      ["מזהה", "מסלול", "סכום", "סטטוס", "נוצר", "שולם"],
      () => paged((c) => dbAll.growCheckout.findMany({ where: mine, ...orderPage, ...c })),
      (r) => [r.id, r.plan, r.sum, r.status, clock(r.createdAt), clock(r.appliedAt)],
    ),
  );

  // Expense files (encrypted names and bytes)
  for await (const rows of paged((c) =>
    dbAll.expense.findMany({
      where: mine,
      select: { id: true, nameCiphertext: true },
      ...orderPage,
      ...c,
    }),
  )) {
    for (const e of rows) {
      let name = e.id;
      try {
        name = decryptSecret(e.nameCiphertext);
      } catch {
        tally.problems.push(`שם קובץ הוצאה שלא ניתן היה לפענח: ${e.id}`);
      }
      entries.push(
        fileEntry(tally, place(`הוצאות/${safeFileName(name)}`), async () => {
          const blob = await dbAll.expenseBlob.findFirst({ where: { expenseId: e.id, expense: mine } });
          return blob
            ? decryptBuffer({ ciphertext: Buffer.from(blob.ciphertext), iv: blob.iv, tag: blob.tag })
            : null;
        }),
      );
    }
  }

  // Uploaded documents (encrypted names and bytes)
  for await (const rows of paged((c) =>
    dbAll.clientDocument.findMany({
      where: mine,
      select: { id: true, clientId: true, nameCiphertext: true },
      ...orderPage,
      ...c,
    }),
  )) {
    for (const d of rows) {
      let name = d.id;
      try {
        name = decryptSecret(d.nameCiphertext);
      } catch {
        tally.problems.push(`שם מסמך שלא ניתן היה לפענח: ${d.id}`);
      }
      entries.push(
        fileEntry(tally, place(`מסמכים/${folder(d.clientId)}/${safeFileName(name)}`), async () => {
          const blob = await dbAll.clientDocumentBlob.findFirst({
            where: { documentId: d.id, document: mine },
          });
          return blob
            ? decryptBuffer({ ciphertext: Buffer.from(blob.ciphertext), iv: blob.iv, tag: blob.tag })
            : null;
        }),
      );
    }
  }

  // Files attached to meetings
  for await (const rows of paged((c) =>
    dbAll.sessionFile.findMany({
      where: mine,
      select: { id: true, clientId: true, fileName: true, fileNameCiphertext: true, createdAt: true },
      ...orderPage,
      ...c,
    }),
  )) {
    for (const f of rows) {
      const path = place(`קבצי פגישות/${folder(f.clientId)}/${day(f.createdAt)} ${safeFileName(sessionFileName(f))}`);
      entries.push(
        fileEntry(tally, path, async () => {
          const row = await dbAll.sessionFile.findFirst({
            where: { id: f.id, userId },
            select: { dataCiphertext: true, dataIv: true, dataTag: true },
          });
          return row
            ? decryptBuffer({ ciphertext: Buffer.from(row.dataCiphertext), iv: row.dataIv, tag: row.dataTag })
            : null;
        }),
      );
    }
  }

  // Screenshots attached to support requests
  for await (const rows of paged((c) =>
    dbAll.supportRequest.findMany({
      where: { ...mine, attachmentCiphertext: { not: null } },
      select: { id: true, attachmentName: true },
      ...orderPage,
      ...c,
    }),
  )) {
    for (const s of rows) {
      entries.push(
        fileEntry(tally, place(`פניות תמיכה/${s.id.slice(-6)} ${safeFileName(s.attachmentName ?? "צילום מסך")}`), async () => {
          const row = await dbAll.supportRequest.findFirst({
            where: { id: s.id, userId },
            select: { attachmentCiphertext: true, attachmentIv: true, attachmentTag: true },
          });
          if (!row?.attachmentCiphertext || !row.attachmentIv || !row.attachmentTag) return null;
          return decryptBuffer({
            ciphertext: Buffer.from(row.attachmentCiphertext),
            iv: row.attachmentIv,
            tag: row.attachmentTag,
          });
        }),
      );
    }
  }

  const files = entries.filter((e) => !e.compress).length;
  entries.push(
    textEntry("סיכום הייצוא.txt", () =>
      [
        "סיכום הייצוא",
        ...Object.entries(tally.counts).map(([path, n]) => `${path}: ${n} שורות`),
        `קבצים: ${files}`,
        "",
        tally.problems.length ? "לא הצליח:" : "הכול נקרא בהצלחה.",
        ...tally.problems,
        "",
      ].join("\r\n"),
    ),
  );
  return entries;
}

/** The ZIP as a stream. Entries are opened one at a time, in order. */
export function zipStream(entries: ExportEntry[], now = new Date()): Readable {
  const zip = new yazl.ZipFile();
  const output = zip.outputStream as unknown as Readable;
  zip.on("error", (err: Error) => output.destroy(err));
  for (const e of entries) {
    zip.addReadStreamLazy(e.path, { mtime: now, compress: e.compress }, (cb) => {
      cb(null, Readable.from(e.body(), { objectMode: false }));
    });
  }
  zip.end();
  return output;
}

/** Runs `done` once the stream ends, fails or its reader goes away. */
export function whenFinished(stream: Readable, done: () => void): void {
  finished(stream, () => done());
}
