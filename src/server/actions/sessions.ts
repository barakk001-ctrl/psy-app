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
import { buildRecurrenceRule, seriesSlots, type Slot } from "@/lib/recurrence";
import {
  createSessionSchema,
  sessionStatusSchema,
  updateSessionSchema,
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

// Sessions overlapping any of the given slots (SCHEDULED only)
async function findOverlaps(userId: string, slots: Slot[], excludeIds?: string[]) {
  return db.session.findMany({
    where: {
      userId,
      status: "SCHEDULED",
      ...(excludeIds?.length ? { id: { notIn: excludeIds } } : {}),
      OR: slots.map((s) => ({
        startsAt: { lt: s.endsAt },
        endsAt: { gt: s.startsAt },
      })),
    },
    select: {
      startsAt: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
}

function overlapError(
  overlaps: Awaited<ReturnType<typeof findOverlaps>>,
): SessionFormState {
  const fmt = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  const list = overlaps
    .map((o) => `${o.client.firstName} ${o.client.lastName} — ${fmt.format(o.startsAt)}`)
    .join(", ");
  return {
    error: `הזמן חופף לפגישה קיימת: ${list}. ניתן לסמן "אפשר חפיפה" כדי לשמור בכל זאת.`,
  };
}


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
    recurrence: formData.get("recurrence") ?? "NONE",
    occurrences: formData.get("occurrences") ?? "",
    allowOverlap: formData.get("allowOverlap"),
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
  const durationMs = data.durationMinutes * 60 * 1000;
  const rate = data.rate ?? (client.defaultRate ? Number(client.defaultRate) : null);

  const intervalWeeks = data.recurrence === "BIWEEKLY" ? 2 : 1;
  const count = data.recurrence === "NONE" ? 1 : data.occurrences!;
  const slots = seriesSlots(startsAt, durationMs, intervalWeeks, count);

  if (!data.allowOverlap) {
    const overlaps = await findOverlaps(userId, slots);
    if (overlaps.length > 0) return overlapError(overlaps);
  }

  const recurrenceRule =
    data.recurrence === "NONE" ? null : buildRecurrenceRule(intervalWeeks, count);

  const common = {
    userId,
    clientId: client.id,
    location: data.location,
    meetingUrl: data.meetingUrl || null,
    rate: rate ?? undefined,
  };

  const createdIds = await db.$transaction(async (tx) => {
    const parent = await tx.session.create({
      data: {
        ...common,
        startsAt: slots[0].startsAt,
        endsAt: slots[0].endsAt,
        recurrenceRule,
      },
    });
    const ids = [parent.id];
    for (const slot of slots.slice(1)) {
      const child = await tx.session.create({
        data: {
          ...common,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          parentSessionId: parent.id,
        },
      });
      ids.push(child.id);
    }
    return ids;
  });

  for (const id of createdIds) {
    await scheduleSessionReminders(id);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${client.id}`);
  redirect(`/sessions/${createdIds[0]}`);
}

export async function updateSessionAction(
  _: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const userId = await requireUserId();

  const parsed = updateSessionSchema.safeParse({
    id: formData.get("id"),
    clientId: formData.get("clientId"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    location: formData.get("location"),
    meetingUrl: formData.get("meetingUrl") ?? "",
    rate: formData.get("rate") ?? "",
    allowOverlap: formData.get("allowOverlap"),
  });

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Verify ownership and load existing session
  const existing = await db.session.findFirst({
    where: { id: data.id, userId },
    select: { id: true, startsAt: true, status: true, clientId: true },
  });
  if (!existing) return { error: "פגישה לא נמצאה" };

  // Verify the client belongs to this user
  const client = await db.client.findFirst({
    where: { id: data.clientId, userId },
    select: { id: true },
  });
  if (!client) return { error: "לקוח לא נמצא" };

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60 * 1000);

  if (!data.allowOverlap) {
    const overlaps = await findOverlaps(userId, [{ startsAt, endsAt }], [data.id]);
    if (overlaps.length > 0) return overlapError(overlaps);
  }

  await db.session.update({
    where: { id: data.id, userId },
    data: {
      clientId: data.clientId,
      startsAt,
      endsAt,
      location: data.location,
      meetingUrl: data.meetingUrl || null,
      rate: data.rate ?? null,
    },
  });

  // If the time changed and the session is still scheduled, refresh reminders
  const timeChanged = startsAt.getTime() !== existing.startsAt.getTime();
  if (timeChanged && existing.status === "SCHEDULED") {
    await rescheduleSessionReminders(data.id);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/sessions/${data.id}`);
  revalidatePath(`/clients/${data.clientId}`);
  if (existing.clientId !== data.clientId) {
    revalidatePath(`/clients/${existing.clientId}`);
  }
  redirect(`/sessions/${data.id}`);
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
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: "תאריך לא תקין" };
  }

  const overlaps = await findOverlaps(userId, [{ startsAt, endsAt }], [input.id]);
  if (overlaps.length > 0) {
    const state = overlapError(overlaps);
    return { ok: false, error: state?.error };
  }

  await db.session.update({
    where: { id: input.id, userId },
    data: { startsAt, endsAt },
  });

  await rescheduleSessionReminders(input.id);

  revalidatePath("/calendar");
  revalidatePath(`/sessions/${input.id}`);
  return { ok: true };
}

// Delete this session and all future SCHEDULED sessions in the same recurring series
export async function deleteFutureSessionsAction(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const sess = await db.session.findFirst({
    where: { id, userId },
    select: { id: true, startsAt: true, parentSessionId: true, recurrenceRule: true },
  });
  if (!sess) return;
  if (!sess.parentSessionId && !sess.recurrenceRule) return;

  const rootId = sess.parentSessionId ?? sess.id;
  const future = await db.session.findMany({
    where: {
      userId,
      status: "SCHEDULED",
      startsAt: { gte: sess.startsAt },
      OR: [{ id: rootId }, { parentSessionId: rootId }],
    },
    select: { id: true, note: { select: { id: true } } },
  });

  const ids = future.map((s) => s.id);
  const deletableIds = future.filter((s) => !s.note).map((s) => s.id);
  const keepIds = future.filter((s) => s.note).map((s) => s.id);

  await db.$transaction([
    db.reminderJob.updateMany({
      where: { sessionId: { in: ids }, status: "PENDING" },
      data: { status: "CANCELLED" },
    }),
    db.session.updateMany({
      where: { id: { in: keepIds } },
      data: { status: "CANCELLED" },
    }),
    db.session.deleteMany({ where: { id: { in: deletableIds } } }),
  ]);

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/calendar");
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
