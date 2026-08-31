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
  OPEN_ENDED_BATCH,
  buildRecurrenceRule,
  seriesSlots,
  type Slot,
} from "@/lib/recurrence";
import { fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";
import { encryptNote } from "@/lib/crypto";
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
    clientId: formData.get("clientId") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? "50",
    location: formData.get("location"),
    meetingUrl: formData.get("meetingUrl") ?? "",
    rate: formData.get("rate") ?? "",
    treatmentType: formData.get("treatmentType") ?? "טיפול פרטני",
    recurrence: formData.get("recurrence") ?? "NONE",
    openEnded: formData.get("openEnded"),
    occurrences: formData.get("occurrences") ?? "",
    allowOverlap: formData.get("allowOverlap"),
    note: formData.get("note") ?? "",
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

  const durationMs = data.durationMinutes * 60 * 1000;
  const rate = data.rate ?? (client.defaultRate ? Number(client.defaultRate) : null);

  const intervalWeeks = data.recurrence === "BIWEEKLY" ? 2 : 1;
  const openEnded = data.recurrence !== "NONE" && data.openEnded;
  const count =
    data.recurrence === "NONE" ? 1 : openEnded ? OPEN_ENDED_BATCH : data.occurrences!;
  // data.startsAt is a datetime-local string — interpreted as clinic wall-clock
  const slots = seriesSlots(data.startsAt, durationMs, intervalWeeks, count);

  if (!data.allowOverlap) {
    const overlaps = await findOverlaps(userId, slots);
    if (overlaps.length > 0) return overlapError(overlaps);
  }

  const recurrenceRule =
    data.recurrence === "NONE"
      ? null
      : buildRecurrenceRule(intervalWeeks, openEnded ? undefined : count);

  const common = {
    userId,
    clientId: client.id,
    location: data.location,
    meetingUrl: data.meetingUrl || null,
    rate: rate ?? undefined,
    treatmentType: data.treatmentType,
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

  // Optional clinical note for the (first) session — encrypted like all notes
  const noteContent = (data.note ?? "").trim();
  if (noteContent) {
    await db.sessionNote.create({
      data: {
        sessionId: createdIds[0],
        clientId: client.id,
        ...encryptNote(noteContent),
      },
    });
  }

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
    id: formData.get("id") ?? "",
    clientId: formData.get("clientId") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? "50",
    location: formData.get("location"),
    meetingUrl: formData.get("meetingUrl") ?? "",
    rate: formData.get("rate") ?? "",
    allowOverlap: formData.get("allowOverlap"),
    treatmentType: formData.get("treatmentType") ?? "טיפול פרטני",
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

  const startsAt = fromZonedDateTimeLocal(data.startsAt);
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
      treatmentType: data.treatmentType,
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

export type QuickEditState = {
  error?: string;
  saved?: boolean;
  /** conflict detected — allow resubmitting with allowOverlap */
  conflict?: boolean;
} | null;

/** Compact calendar-popup edit: client, date, start/end times, type, cancel toggle. */
export async function quickEditSessionAction(
  _: QuickEditState,
  formData: FormData,
): Promise<QuickEditState> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const treatmentType = String(formData.get("treatmentType") ?? "").trim().slice(0, 60);
  const cancelled = formData.get("cancelled") === "on";
  const allowOverlap = formData.get("allowOverlap") === "on";
  const applyScope = formData.get("applyScope") === "future" ? "future" : "single";

  if (!id || !clientId) return { error: "פרטים חסרים" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "תאריך לא תקין" };
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { error: "שעה לא תקינה" };
  }
  if (endTime <= startTime) return { error: "שעת הסיום חייבת להיות אחרי ההתחלה" };

  const existing = await db.session.findFirst({
    where: { id, userId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      clientId: true,
      parentSessionId: true,
      recurrenceRule: true,
    },
  });
  if (!existing) return { error: "פגישה לא נמצאה" };

  const client = await db.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });
  if (!client) return { error: "לקוח לא נמצא" };

  const startsAt = fromZonedDateTimeLocal(`${date}T${startTime}`);
  const endsAt = fromZonedDateTimeLocal(`${date}T${endTime}`);

  // "Apply to all future": shift every later SCHEDULED session in the series
  // to the new start/end times — and by the same number of days, if the date
  // moved (e.g. the standing Tuesday 9:00 slot becomes Wednesday 9:30).
  const inSeries = !!(existing.parentSessionId || existing.recurrenceRule);
  let futureUpdates: { id: string; startsAt: Date; endsAt: Date }[] = [];
  if (applyScope === "future" && inSeries) {
    const rootId = existing.parentSessionId ?? existing.id;
    const oldDate = toZonedDateTimeLocal(existing.startsAt).slice(0, 10);
    const deltaDays = Math.round(
      (Date.parse(`${date}T00:00Z`) - Date.parse(`${oldDate}T00:00Z`)) / 86400000,
    );
    const laterInSeries = await db.session.findMany({
      where: {
        userId,
        status: "SCHEDULED",
        startsAt: { gt: existing.startsAt },
        OR: [{ id: rootId }, { parentSessionId: rootId }],
        NOT: { id },
      },
      select: { id: true, startsAt: true },
      orderBy: { startsAt: "asc" },
    });
    futureUpdates = laterInSeries.map((s) => {
      const ownDate = toZonedDateTimeLocal(s.startsAt).slice(0, 10);
      const shifted = new Date(Date.parse(`${ownDate}T00:00Z`) + deltaDays * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        id: s.id,
        startsAt: fromZonedDateTimeLocal(`${shifted}T${startTime}`),
        endsAt: fromZonedDateTimeLocal(`${shifted}T${endTime}`),
      };
    });
  }

  if (!allowOverlap) {
    const slots = [
      ...(cancelled ? [] : [{ startsAt, endsAt }]),
      ...futureUpdates.map((u) => ({ startsAt: u.startsAt, endsAt: u.endsAt })),
    ];
    const excludeIds = [id, ...futureUpdates.map((u) => u.id)];
    if (slots.length > 0) {
      const overlaps = await findOverlaps(userId, slots, excludeIds);
      if (overlaps.length > 0) {
        const state = overlapError(overlaps);
        return { error: state?.error, conflict: true };
      }
    }
  }

  const nextStatus = cancelled
    ? "CANCELLED"
    : existing.status === "CANCELLED"
      ? "SCHEDULED"
      : existing.status;

  await db.$transaction([
    db.session.update({
      where: { id, userId },
      data: {
        clientId,
        startsAt,
        endsAt,
        status: nextStatus,
        ...(treatmentType ? { treatmentType } : {}),
      },
    }),
    ...futureUpdates.map((u) =>
      db.session.update({
        where: { id: u.id, userId },
        data: { startsAt: u.startsAt, endsAt: u.endsAt },
      }),
    ),
  ]);

  if (nextStatus === "SCHEDULED") {
    await rescheduleSessionReminders(id);
  } else {
    await cancelSessionReminders(id);
  }
  for (const u of futureUpdates) {
    await rescheduleSessionReminders(u.id);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/sessions/${id}`);
  revalidatePath(`/clients/${clientId}`);
  if (existing.clientId !== clientId) revalidatePath(`/clients/${existing.clientId}`);
  return { saved: true };
}

export type SessionPaymentState = {
  error?: string;
  saved?: boolean;
} | null;

const PAYMENT_STATUSES = ["PAID", "UNPAID", "EXEMPT"] as const;
const PAYMENT_METHODS = [
  "CASH",
  "BIT",
  "CHECK",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "PAYPAL",
  "OTHER",
] as const;

/** Quick per-meeting payment record — the Morning-first workflow that skips
 *  the app's invoice module entirely. */
export async function saveSessionPaymentAction(
  _: SessionPaymentState,
  formData: FormData,
): Promise<SessionPaymentState> {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");
  const statusRaw = String(formData.get("paymentStatus") ?? "");
  const methodRaw = String(formData.get("paymentMethod") ?? "");
  const amountRaw = String(formData.get("paidAmount") ?? "").trim();
  const note = String(formData.get("paymentNote") ?? "").trim().slice(0, 300);

  if (!sessionId) return { error: "מזהה פגישה חסר" };

  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) return { error: "פגישה לא נמצאה" };

  const status = (PAYMENT_STATUSES as readonly string[]).includes(statusRaw)
    ? statusRaw
    : null;
  const method = (PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof PAYMENT_METHODS)[number])
    : null;
  const amount = amountRaw ? parseFloat(amountRaw) : null;
  if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
    return { error: "סכום לא תקין" };
  }

  await db.session.update({
    where: { id: sessionId },
    data: {
      paymentStatus: status,
      paymentMethod: status === "PAID" ? method : null,
      paidAmount: status === "PAID" ? amount : null,
      paymentNote: note || null,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/clients/${session.clientId}`);
  revalidatePath("/dashboard");
  return { saved: true };
}

// Permanent removal — cancellation is a separate status action that keeps the
// meeting in the client's record; deletion erases it (and its note) entirely.
export async function deleteSessionAction(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await db.session.findFirst({
    where: { id, userId },
    select: { id: true, clientId: true },
  });
  if (!existing) return;

  await cancelSessionReminders(id);
  await db.session.delete({ where: { id, userId } });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${existing.clientId}`);
  redirect("/calendar");
}
