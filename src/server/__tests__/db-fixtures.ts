// A made-up practice, for the *.db.test.ts suites. All names and notes are
// invented; every practice's text carries its own canary so a test can tell
// whose data came back.

import type { PrismaClient } from "@prisma/client";
import { encryptBuffer, encryptNote, encryptSecret } from "@/lib/crypto";

export type Practice = {
  tag: string;
  canary: string;
  userId: string;
  email: string;
  clientId: string;
  inactiveClientId: string;
  trashedClientId: string;
  sessionId: string;
  seriesSessionId: string;
  pastSessionId: string;
  fileId: string;
  documentId: string;
  oldInvoiceId: string;
  paymentId: string;
  draftDocId: string;
  expenseId: string;
  issuedDocId: string;
  inboxId: string;
  todoId: string;
  meetingTypeId: string;
  waitlistId: string;
  morningDocId: string;
  supportId: string;
  inviteId: string;
  calendarToken: string;
  inboxToken: string;
  inboxApiToken: string;
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
export const PDF_BYTES = Buffer.from("%PDF-1.4\n% made-up test file\n%%EOF\n");

/** 08:00 UTC, the first meeting of every practice: fixed so two practices overlap. */
export function firstMeetingAt(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 11, 8, 0));
}

/** A practice with one of everything. */
export async function seedPractice(
  db: PrismaClient,
  tag: string,
  overrides: { isAdmin?: boolean } = {},
): Promise<Practice> {
  const canary = `קנרי${tag}`;
  const email = `therapist-${tag.toLowerCase()}@example.test`;
  const base = firstMeetingAt();

  const user = await db.user.create({
    data: {
      email,
      name: `מטפל ${canary}`,
      businessName: `קליניקה ${canary}`,
      businessId: "000000018",
      vatLiable: true,
      subscriptionExempt: true,
      isAdmin: overrides.isAdmin ?? false,
      calendarToken: `calendar-token-of-practice-${tag}-0000`,
      inboxToken: `public-link-of-practice-${tag}`,
      inboxApiToken: `api-key-of-practice-${tag}`,
      // a packed secret on the User row (2FA not switched on), for the rotation tests
      totpSecret: encryptSecret(`secret-${tag}`),
      onboardingCompletedAt: new Date(),
    },
  });
  const userId = user.id;

  const client = await db.client.create({
    data: {
      userId,
      firstName: canary,
      lastName: "לקוח",
      email: `client-${tag.toLowerCase()}@example.test`,
      idNumber: "000000026",
      generalNotes: `הערות ${canary}`,
    },
  });
  const inactive = await db.client.create({
    data: { userId, firstName: `לא-פעיל-${canary}`, lastName: "לקוח", status: "INACTIVE" },
  });
  const trashed = await db.client.create({
    data: {
      userId,
      firstName: `בסל-${canary}`,
      lastName: "לקוח",
      status: "INACTIVE",
      deletedAt: new Date(Date.now() - DAY),
    },
  });

  const slot = (days: number) => ({
    startsAt: new Date(base.getTime() + days * DAY),
    endsAt: new Date(base.getTime() + days * DAY + HOUR),
  });
  const session = await db.session.create({
    data: { userId, clientId: client.id, ...slot(0), rate: 400 },
  });
  await db.sessionNote.create({
    data: { sessionId: session.id, clientId: client.id, ...encryptNote(`סיכום ${canary}`) },
  });
  const series = await db.session.create({
    data: { userId, clientId: client.id, ...slot(1), recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=2" },
  });
  await db.session.create({
    data: { userId, clientId: client.id, ...slot(8), parentSessionId: series.id },
  });
  const past = await db.session.create({
    data: {
      userId,
      clientId: client.id,
      startsAt: new Date(Date.now() - 7 * DAY),
      endsAt: new Date(Date.now() - 7 * DAY + HOUR),
      rate: 400,
    },
  });
  await db.reminderJob.create({
    data: {
      userId,
      sessionId: session.id,
      channel: "EMAIL",
      scheduledFor: new Date(session.startsAt.getTime() - DAY),
    },
  });

  const enc = encryptBuffer(PDF_BYTES);
  const file = await db.sessionFile.create({
    data: {
      userId,
      sessionId: session.id,
      clientId: client.id,
      fileName: `קובץ-${canary}.pdf`,
      mimeType: "application/pdf",
      size: PDF_BYTES.length,
      dataCiphertext: new Uint8Array(enc.ciphertext),
      dataIv: enc.iv,
      dataTag: enc.tag,
    },
  });
  const expenseEnc = encryptBuffer(PDF_BYTES);
  const expense = await db.expense.create({
    data: {
      userId,
      status: "APPROVED",
      docType: 305,
      docDate: new Date(Date.UTC(2026, 9, 12)),
      supplier: `ספק ${canary}`,
      amount: 118,
      vatAmount: 18,
      nameCiphertext: encryptSecret(`הוצאה-${canary}.pdf`),
      mimeType: "application/pdf",
      size: PDF_BYTES.length,
      blob: {
        create: {
          ciphertext: new Uint8Array(expenseEnc.ciphertext),
          iv: expenseEnc.iv,
          tag: expenseEnc.tag,
        },
      },
    },
  });
  const document = await db.clientDocument.create({
    data: {
      userId,
      clientId: client.id,
      nameCiphertext: encryptSecret(`מסמך-${canary}.pdf`),
      mimeType: "application/pdf",
      size: PDF_BYTES.length,
      blob: { create: { ciphertext: new Uint8Array(enc.ciphertext), iv: enc.iv, tag: enc.tag } },
    },
  });

  const oldInvoice = await db.invoice.create({
    data: {
      userId,
      clientId: client.id,
      number: 1,
      status: "PARTIALLY_PAID",
      subtotal: 400,
      total: 400,
      amountPaid: 100,
      notes: `הערה ${canary}`,
      items: { create: { description: `פגישה ${canary}`, quantity: 1, unitPrice: 400, amount: 400 } },
      payments: { create: { amount: 100, method: "CASH", notes: `תשלום ${canary}` } },
    },
    include: { payments: true },
  });
  const draftDoc = await db.invoice.create({
    data: {
      userId,
      clientId: client.id,
      number: 2,
      docType: 305,
      status: "DRAFT",
      subtotal: 300,
      total: 300,
      docClientName: canary,
      items: { create: { description: `טיוטה ${canary}`, quantity: 1, unitPrice: 300, amount: 300 } },
    },
  });
  const issuedDoc = await db.invoice.create({
    data: {
      userId,
      clientId: client.id,
      number: 3,
      docType: 305,
      status: "SENT",
      subtotal: 200,
      total: 200,
      docClientName: canary,
      morningDocId: `morning-doc-${tag}`,
      morningDocNumber: "9001",
      morningIssuedAt: new Date(),
      items: { create: { description: `הופק ${canary}`, quantity: 1, unitPrice: 200, amount: 200 } },
    },
  });
  await db.user.update({ where: { id: userId }, data: { nextInvoiceNumber: 4 } });

  const inbox = await db.inboxMessage.create({ data: { userId, text: `הודעה ${canary}` } });
  const todo = await db.todo.create({ data: { userId, text: `משימה ${canary}` } });
  const meetingType = await db.meetingType.create({ data: { userId, name: `סוג ${canary}` } });
  const waitlist = await db.waitlistEntry.create({
    data: { userId, fullName: `ממתין ${canary}`, notesCiphertext: encryptSecret(`רקע ${canary}`) },
  });
  const morningDoc = await db.morningDocument.create({
    data: {
      userId,
      morningId: `synced-${tag}`,
      number: "7001",
      morningClientName: canary,
      url: "https://example.test/doc",
    },
  });
  const invite = await db.inviteCode.create({
    data: { code: `TEST${tag}ABCDEFG`.slice(0, 12), createdById: userId },
  });
  const support = await db.supportRequest.create({
    data: {
      userId,
      name: canary,
      email,
      subject: `נושא ${canary}`,
      message: `פנייה ${canary}`,
      attachmentName: "shot.png",
      attachmentType: "image/png",
      attachmentSize: PDF_BYTES.length,
      attachmentCiphertext: new Uint8Array(enc.ciphertext),
      attachmentIv: enc.iv,
      attachmentTag: enc.tag,
    },
  });
  await db.auditLog.create({
    data: { userId, action: "NOTE_VIEW", sessionId: session.id, clientId: client.id },
  });
  await db.growCheckout.create({
    data: {
      userId,
      plan: "MONTHLY",
      sum: 100,
      processId: `process-${tag}`,
      status: "APPLIED",
      transactionId: `tx-${tag}`,
    },
  });
  await db.billingEvent.create({
    data: { userId, transactionId: `tx-${tag}`, plan: "MONTHLY", amount: 100, raw: `{"who":"${canary}"}` },
  });

  return {
    tag,
    canary,
    userId,
    email,
    clientId: client.id,
    inactiveClientId: inactive.id,
    trashedClientId: trashed.id,
    sessionId: session.id,
    seriesSessionId: series.id,
    pastSessionId: past.id,
    fileId: file.id,
    documentId: document.id,
    oldInvoiceId: oldInvoice.id,
    paymentId: oldInvoice.payments[0].id,
    draftDocId: draftDoc.id,
    expenseId: expense.id,
    issuedDocId: issuedDoc.id,
    inboxId: inbox.id,
    todoId: todo.id,
    meetingTypeId: meetingType.id,
    waitlistId: waitlist.id,
    morningDocId: morningDoc.id,
    supportId: support.id,
    inviteId: invite.id,
    calendarToken: user.calendarToken!,
    inboxToken: user.inboxToken!,
    inboxApiToken: user.inboxApiToken!,
  };
}

const sorted = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.id.localeCompare(b.id));

function stable(value: unknown): string {
  return JSON.stringify(value, (key, v) => {
    // A no-op touch is not a change of data
    if (key === "updatedAt") return undefined;
    if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
    if (v && typeof v === "object" && v.type === "Buffer") return Buffer.from(v.data).toString("base64");
    return v;
  });
}

/**
 * Everything stored for one user, as comparable text. Any write to any of their
 * rows, or a row added to or taken out of their data, changes it.
 */
export async function fingerprint(db: PrismaClient, userId: string): Promise<string> {
  const mine = { userId };
  const viaClient = { client: { userId } };
  const [
    user,
    clients,
    sessions,
    notes,
    files,
    documents,
    blobs,
    expenses,
    expenseBlobs,
    invoices,
    items,
    payments,
    todos,
    inbox,
    morning,
    reminders,
    support,
    invites,
    waitlist,
    types,
    audit,
    checkouts,
    billing,
  ] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.client.findMany({ where: mine }),
    db.session.findMany({ where: mine }),
    db.sessionNote.findMany({ where: viaClient }),
    db.sessionFile.findMany({ where: mine }),
    db.clientDocument.findMany({ where: mine }),
    db.clientDocumentBlob.findMany({ where: { document: mine } }),
    db.expense.findMany({ where: mine }),
    db.expenseBlob.findMany({ where: { expense: mine } }),
    db.invoice.findMany({ where: mine }),
    db.invoiceItem.findMany({ where: { invoice: mine } }),
    db.payment.findMany({ where: { invoice: mine } }),
    db.todo.findMany({ where: mine }),
    db.inboxMessage.findMany({ where: mine }),
    db.morningDocument.findMany({ where: mine }),
    db.reminderJob.findMany({ where: mine }),
    db.supportRequest.findMany({ where: mine }),
    db.inviteCode.findMany({ where: { createdById: userId } }),
    db.waitlistEntry.findMany({ where: mine }),
    db.meetingType.findMany({ where: mine }),
    db.auditLog.findMany({ where: mine }),
    db.growCheckout.findMany({ where: mine }),
    db.billingEvent.findMany({ where: mine }),
  ]);
  return stable({
    user,
    clients: sorted(clients),
    sessions: sorted(sessions),
    notes: sorted(notes),
    files: sorted(files),
    documents: sorted(documents),
    blobs: [...blobs].sort((a, b) => a.documentId.localeCompare(b.documentId)),
    expenses: sorted(expenses),
    expenseBlobs: [...expenseBlobs].sort((a, b) => a.expenseId.localeCompare(b.expenseId)),
    invoices: sorted(invoices),
    items: sorted(items),
    payments: sorted(payments),
    todos: sorted(todos),
    inbox: sorted(inbox),
    morning: sorted(morning),
    reminders: sorted(reminders),
    support: sorted(support),
    invites: sorted(invites),
    waitlist: sorted(waitlist),
    types: sorted(types),
    audit: sorted(audit),
    checkouts: sorted(checkouts),
    billing: sorted(billing),
  });
}

/** Rows that point across practices. Must always be empty. */
export async function crossLinks(db: PrismaClient): Promise<string[]> {
  const checks: Record<string, string> = {
    "session→client": `SELECT s.id FROM "Session" s JOIN "Client" c ON c.id = s."clientId" WHERE c."userId" <> s."userId"`,
    "session→series": `SELECT s.id FROM "Session" s JOIN "Session" p ON p.id = s."parentSessionId" WHERE p."userId" <> s."userId"`,
    "note→client": `SELECT n.id FROM "SessionNote" n JOIN "Session" s ON s.id = n."sessionId" JOIN "Client" c ON c.id = n."clientId" WHERE c."userId" <> s."userId"`,
    "file→session": `SELECT f.id FROM "SessionFile" f JOIN "Session" s ON s.id = f."sessionId" WHERE s."userId" <> f."userId"`,
    "file→client": `SELECT f.id FROM "SessionFile" f JOIN "Client" c ON c.id = f."clientId" WHERE c."userId" <> f."userId"`,
    "document→client": `SELECT d.id FROM "ClientDocument" d JOIN "Client" c ON c.id = d."clientId" WHERE c."userId" <> d."userId"`,
    "invoice→client": `SELECT i.id FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" WHERE c."userId" <> i."userId"`,
    "invoice→related": `SELECT i.id FROM "Invoice" i JOIN "Invoice" r ON r.id = i."relatedInvoiceId" WHERE r."userId" <> i."userId"`,
    "item→session": `SELECT t.id FROM "InvoiceItem" t JOIN "Invoice" i ON i.id = t."invoiceId" JOIN "Session" s ON s.id = t."sessionId" WHERE s."userId" <> i."userId"`,
    "morning→client": `SELECT m.id FROM "MorningDocument" m JOIN "Client" c ON c.id = m."clientId" WHERE c."userId" <> m."userId"`,
    "reminder→session": `SELECT r.id FROM "ReminderJob" r JOIN "Session" s ON s.id = r."sessionId" WHERE s."userId" <> r."userId"`,
  };
  const found: string[] = [];
  for (const [name, sql] of Object.entries(checks)) {
    const rows = await db.$queryRawUnsafe<{ id: string }[]>(sql);
    if (rows.length) found.push(`${name}: ${rows.length}`);
  }
  return found;
}
