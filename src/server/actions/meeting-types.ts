"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function addMeetingTypeAction(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;

  const max = await db.meetingType.aggregate({
    where: { userId },
    _max: { position: true },
  });

  try {
    await db.meetingType.create({
      data: { userId, name, position: (max._max.position ?? -1) + 1 },
    });
  } catch {
    // Duplicate name — already in the list, nothing to do
  }
  revalidatePath("/settings");
}

export async function setMeetingTypeColorAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("color") ?? "");
  // Empty clears back to the default calendar color
  const color = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : null;
  if (!id) return;

  await db.meetingType.updateMany({ where: { id, userId }, data: { color } });
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function deleteMeetingTypeAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Existing clients/meetings keep their stored label; only the option is removed
  await db.meetingType.deleteMany({ where: { id, userId } });
  revalidatePath("/settings");
}
