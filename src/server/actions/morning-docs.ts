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