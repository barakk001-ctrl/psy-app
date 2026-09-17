"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { typesToCreate } from "@/lib/meeting-types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function addMeetingTypeAction(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;

  const existing = await db.meetingType.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { name: true, position: true },
  });

  // On the very first add the defaults are written out too, or they would vanish
  // from every form the moment this user owned a single type of their own.
  const names = typesToCreate(existing.map((t) => t.name), name);
  let position = existing.reduce((m, t) => Math.max(m, t.position), -1);

  for (const n of names) {
    position += 1;
    try {
      await db.meetingType.create({ data: { userId, name: n, position } });
    } catch {
      // Duplicate name — already in the list, nothing to do
      position -= 1;
    }
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
