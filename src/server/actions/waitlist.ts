"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { waitlistEntrySchema } from "@/server/validators/waitlist";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type WaitlistFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

function parse(formData: FormData) {
  return waitlistEntrySchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

function revalidateWaitlist() {
  revalidatePath("/clients");
}

/** Adds someone to the waiting list ("הוספה לרשימת ההמתנה"). */
export async function addWaitlistEntryAction(
  _: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "אנא תקנו את השגיאות בטופס", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { fullName, phone, notes } = parsed.data;
  await db.waitlistEntry.create({
    data: {
      userId,
      fullName,
      phone: phone || null,
      notesCiphertext: notes ? encryptSecret(notes) : null,
    },
  });
  revalidateWaitlist();
  return { ok: true };
}

/** Edits an entry's name, phone or notes. */
export async function updateWaitlistEntryAction(
  _: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "הרשומה לא נמצאה" };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "אנא תקנו את השגיאות בטופס", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { fullName, phone, notes } = parsed.data;
  const res = await db.waitlistEntry.updateMany({
    where: { id, userId },
    data: {
      fullName,
      phone: phone || null,
      notesCiphertext: notes ? encryptSecret(notes) : null,
    },
  });
  if (res.count === 0) return { error: "הרשומה לא נמצאה" };
  revalidateWaitlist();
  return { ok: true };
}

/** Removes an entry (she found another therapist, no longer interested…). */
export async function deleteWaitlistEntryAction(id: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  await db.waitlistEntry.deleteMany({ where: { id, userId } });
  revalidateWaitlist();
  return {};
}
