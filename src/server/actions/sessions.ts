"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  cancelSessionReminders,
  rescheduleSessionReminders,
  scheduleSessionReminders,
} from "@/lib/reminders";
import {
  createSessionSchema,
  sessionStatusSchema,
} from "@/server/validators/session";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SessionFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export async function createSessionAction(
  _: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const userId = await requireUserId();

  const parsed = createSessionSchema.safeParse({
    clientId: formData.get("clientId"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    location: formData.get("location"),
    meetingUrl: formData.get("meetingUrl") ?? "",
    rate: formData.get("rate") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Verify the client belongs to this user
  const client = await db.client.findFirst({
    where: { id: data.clientId, userId },
    select: { id: true, defaultRate: true },
  });
  if (!client) return { error: "לקוח לא נמצא" };

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60 * 1000);
  const rate = data.rate ?? (client.defaultRate ? Number(client.defaultRate) : null);

  const created = await db.session.create({
    data: {
      userId,
      clientId: client.id,
      startsAt,
      endsAt,
      location: data.location,
      meetingUrl: data.meetingUrl || null,
      rate: rate ?? undefined,
    },
  });

  await scheduleSessionReminders(created.id);

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${client.id}`);
  redirect(`/sessions/${created.id}`);
}

export async function updateSessionStatusAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = sessionStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await db.session.update({
    where: { id: parsed.data.id, userId },
    data: { status: parsed.data.status },
  });

  // If the session is no longer scheduled, cancel pending reminders.
  // If it goes back to SCHEDULED, recreate them.
  if (parsed.data.status === "SCHEDULED") {
    await scheduleSessionReminders(parsed.data.id);
  } else {
    await cancelSessionReminders(parsed.data.id);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/sessions/${parsed.data.id}`);
}

export async function rescheduleSessionAction(input: {
  id: string;
  startsAt: string;
  endsAt: string;
}) {
  const userId = await requireUserId();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return;

  await db.session.update({
    where: { id: input.id, userId },
    data: { startsAt, endsAt },
  });

  await rescheduleSessionReminders(input.id);

  revalidatePath("/calendar");
  revalidatePath(`/sessions/${input.id}`);
}

export async function deleteSessionAction(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  // Hard delete only if scheduled and has no note. Otherwise keep history.
  const existing = await db.session.findFirst({
    where: { id, userId },
    include: { note: { select: { id: true } } },
  });
  if (!existing) return;

  // Cancel any pending reminders either way (FK cascade would also do it on delete,
  // but we want them in CANCELLED state for audit if we keep the session row)
  await cancelSessionReminders(id);

  if (existing.note || existing.status === "COMPLETED") {
    await db.session.update({
      where: { id, userId },
      data: { status: "CANCELLED" },
    });
  } else {
    await db.session.delete({ where: { id, userId } });
  }

  revalidatePath("/calendar");
  redirect("/calendar");
}
