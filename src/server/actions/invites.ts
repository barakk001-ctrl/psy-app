"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateInviteCode, inviteExpiry } from "@/lib/invite-codes";
import { inviteCodeSchema } from "@/server/validators/invites";

/** Admin-only: Settings → הזמנות. Same check as the subscriptions card. */
async function requireAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) throw new Error("Forbidden");
  return session.user.id;
}

export type InviteFormState = {
  error?: string;
  /** Changes on each success, so the form knows to clear itself */
  createdCode?: string;
} | null;

export async function createInviteCodeAction(
  _: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const adminId = await requireAdminId();

  const parsed = inviteCodeSchema.safeParse({
    note: formData.get("note") ?? "",
    maxUses: formData.get("maxUses") ?? "1",
    expiresInDays: formData.get("expiresInDays") ?? "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים שגויים" };

  const code = generateInviteCode(crypto.randomInt);
  await db.inviteCode.create({
    data: {
      code,
      note: parsed.data.note || null,
      maxUses: parsed.data.maxUses,
      expiresAt: inviteExpiry(parsed.data.expiresInDays, Date.now()),
      createdById: adminId,
    },
  });
  revalidatePath("/settings");
  return { createdCode: code };
}

/** A revoked code stops working at once; accounts it opened stay as they are. */
export async function revokeInviteCodeAction(formData: FormData) {
  await requireAdminId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.inviteCode.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/settings");
}
