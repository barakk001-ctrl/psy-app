"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getMorningCredentials,
  mapMorningSearchItem,
  searchMorningDocuments,
} from "@/lib/morning";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type MorningSyncState = {
  error?: string;
  synced?: number;
} | null;

/**
 * Pulls documents issued directly in Morning (last 90 days) that the app
 * doesn't know about, into the general inbox for manual assignment.
 */
export async function syncMorningDocumentsAction(
  _: MorningSyncState,
  __: FormData,
): Promise<MorningSyncState> {
  const userId = await requireUserId();

  const creds = await getMorningCredentials(userId);
  if (!creds) return { error: "חשבון morning לא מחובר" };

  const iso = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  const now = new Date();
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const result = await searchMorningDocuments(userId, creds, {
    fromDate: iso(from),
    toDate: iso(now),
  });
  if (!result.ok) return { error: `משיכת המסמכים נכשלה: ${result.error}` };

  // Exclude documents the app itself issued (linked to an invoice)
  const linked = await db.invoice.findMany({
    where: { userId, morningDocId: { not: null } },
    select: { morningDocId: true },
  });
  const linkedIds = new Set(linked.map((i) => i.morningDocId));

  let synced = 0;
  for (const item of result.data) {
    if (!item.id || linkedIds.has(item.id)) continue;
    const mapped = mapMorningSearchItem(item);
    await db.morningDocument.upsert({
      where: { id: mapped.id },
      create: { ...mapped, userId },
      // Refresh Morning-side fields but never touch the manual assignment
      update: {
        number: mapped.number,
        docType: mapped.docType,
        docDate: mapped.docDate,
        amount: mapped.amount,
        description: mapped.description,
        morningClientName: mapped.morningClientName,
        url: mapped.url,
      },
    });
    synced++;
  }

  revalidatePath("/invoices");
  return { synced };
}

export type AttachNumberState = {
  error?: string;
  saved?: boolean;
  matchedUrl?: string | null;
} | null;

/**
 * Attaches a Morning invoice/receipt number (typed by the practitioner) to a
 * meeting. If the number matches a synced Morning document or an app-issued
 * invoice, the document link is resolved automatically.
 */
export async function attachMorningNumberToSessionAction(
  _: AttachNumberState,
  formData: FormData,
): Promise<AttachNumberState> {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");
  const number = String(formData.get("number") ?? "").trim().slice(0, 30);
  if (!sessionId) return { error: "מזהה פגישה חסר" };

  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) return { error: "פגישה לא נמצאה" };

  // Empty input clears the link
  if (!number) {
    await db.session.update({
      where: { id: sessionId },
      data: { morningDocNumber: null, morningDocUrl: null },
    });
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/clients/${session.clientId}`);
    return { saved: true, matchedUrl: null };
  }

  // Resolve a link: synced Morning documents first, then app-issued invoices
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
    data: { morningDocNumber: number, morningDocUrl: url },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/clients/${session.clientId}`);
  return { saved: true, matchedUrl: url };
}

export async function assignMorningDocumentAction(formData: FormData) {
  const userId = await requireUserId();
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