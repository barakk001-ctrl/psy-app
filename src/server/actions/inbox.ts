"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function generateInboxTokenAction() {
  const userId = await requireUserId();
  const token = crypto.randomBytes(18).toString("base64url");
  await db.user.update({ where: { id: userId }, data: { inboxToken: token } });
  revalidatePath("/settings");
}

export async function revokeInboxTokenAction() {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { inboxToken: null } });
  revalidatePath("/settings");
}

export async function processInboxMessageAction(id: string): Promise<string | null> {
  const userId = await requireUserId();
  const msg = await db.inboxMessage.findFirst({
    where: { id, userId },
    select: { id: true, text: true },
  });
  if (!msg) return null;
  await db.inboxMessage.update({ where: { id }, data: { processed: true } });
  revalidatePath("/import");
  return msg.text;
}

export async function deleteInboxMessageAction(id: string) {
  const userId = await requireUserId();
  await db.inboxMessage.deleteMany({ where: { id, userId } });
  revalidatePath("/import");
}

// ── Public appointment-request form (no login; token identifies the user) ──

export type RequestFormState = {
  error?: string;
  sent?: boolean;
} | null;

export async function submitAppointmentRequestAction(
  _: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const preferred = String(formData.get("preferred") ?? "").trim().slice(0, 200);
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);

  if (!token) return { error: "קישור לא תקין" };
  if (!name || !phone) return { error: "נא למלא שם וטלפון" };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = rateLimit(`request:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!limited.allowed) return { error: "יותר מדי בקשות — נסו שוב מאוחר יותר" };

  const user = await db.user.findUnique({
    where: { inboxToken: token },
    select: { id: true },
  });
  if (!user) return { error: "קישור לא תקין" };

  const text = [
    `בקשת פגישה מ${name}`,
    `טלפון: ${phone}`,
    preferred && `מועד מועדף: ${preferred}`,
    message,
  ]
    .filter(Boolean)
    .join("\n");

  await db.inboxMessage.create({ data: { userId: user.id, text } });
  return { sent: true };
}
