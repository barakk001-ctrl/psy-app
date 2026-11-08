"use server";

import { documentsEnabled, DOCUMENTS_OFF_PATH } from "@/lib/features";

// Numbers of documents issued outside the app, typed onto a meeting
// ("מספר המסמך שהופק"), and the documents imported from morning before the
// integration was removed (2026-11-08): no new ones arrive, the ones already
// imported can still be assigned to a client and supply a link by number.

import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly, requireWritable } from "@/lib/subscription-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type AttachNumberState = {
  error?: string;
  saved?: boolean;
  matchedUrl?: string | null;
} | null;

/**
 * Attaches the number of a document issued elsewhere (typed by the
 * practitioner) to a meeting. If the number matches an imported document or
 * a document in the app, its link is filled in automatically.
 */
export async function attachDocumentNumberToSessionAction(
  _: AttachNumberState,
  formData: FormData,
): Promise<AttachNumberState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const sessionId = String(formData.get("sessionId") ?? "");
  const number = String(formData.get("number") ?? "").trim().slice(0, 30);
  // "invoice" = חשבונית מס, "receipt" = קבלה, "invoiceReceipt" = חשבונית
  // מס/קבלה — a single combined document
  const rawKind = formData.get("kind");
  const kind =
    rawKind === "receipt" || rawKind === "invoiceReceipt" ? rawKind : "invoice";
  if (!sessionId) return { error: "מזהה פגישה חסר" };

  // The columns keep their morning-era names (history: existing numbers stay)
  const FIELDS = {
    invoice: ["morningDocNumber", "morningDocUrl"],
    receipt: ["morningReceiptNumber", "morningReceiptUrl"],
    invoiceReceipt: ["morningInvoiceReceiptNumber", "morningInvoiceReceiptUrl"],
  } as const;
  const [numberField, urlField] = FIELDS[kind];

  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) return { error: "פגישה לא נמצאה" };

  // Empty input clears the link
  if (!number) {
    await db.session.update({
      where: { id: sessionId },
      data: { [numberField]: null, [urlField]: null },
    });
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/clients/${session.clientId}`);
    return { saved: true, matchedUrl: null };
  }

  // Resolve a link: imported documents first, then documents in the app
  let url: string | null = null;
  const doc = await db.morningDocument.findFirst({
    where: { userId, number },
    select: { url: true, id: true, clientId: true },
  });
  if (doc) {
    url = doc.url;
    // Typing the number on a client's meeting is also an assignment
    if (!doc.clientId) {
      await db.morningDocument.update({
        where: { id: doc.id },
        data: { clientId: session.clientId },
      });
    }
  } else {
    const invoice = await db.invoice.findFirst({
      where: { userId, morningDocNumber: number },
      select: { morningDocUrl: true },
    });
    url = invoice?.morningDocUrl ?? null;
  }

  await db.session.update({
    where: { id: sessionId },
    data: { [numberField]: number, [urlField]: url },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/clients/${session.clientId}`);
  return { saved: true, matchedUrl: url };
}

/** Assigns a document imported from morning (before 2026-11-08) to a client. */
export async function assignImportedDocumentAction(formData: FormData) {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) redirect(DOCUMENTS_OFF_PATH);
  await requireWritable(userId);
  const docId = String(formData.get("docId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!docId || !clientId) return;

  // Verify both belong to this user
  const [doc, client] = await Promise.all([
    db.morningDocument.findFirst({ where: { id: docId, userId }, select: { id: true } }),
    db.client.findFirst({ where: { id: clientId, userId }, select: { id: true } }),
  ]);
  if (!doc || !client) return;

  await db.morningDocument.update({
    where: { id: docId },
    data: { clientId },
  });

  revalidatePath("/invoices");
  revalidatePath(`/clients/${clientId}`);
}
