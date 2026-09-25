"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { DEFAULT_SESSION_MINUTES } from "@/lib/session-duration";

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
import { fromZonedDateTimeLocal } from "@/lib/timezone";
import { encryptNote } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { moveFollowers, slotLabel, type MovedSlot } from "@/lib/standing-slot";
import { keepReasonsText } from "@/lib/bulk-delete";
import {
  keepSeriesLinked,
  loadFutureDeletePlan,
  loadSlotFollowers,
} from "@/lib/session-scope";
import {
  createSessionSchema,
  sessionStatusSchema,
  updateSessionSchema,
} from "@/server/validators/session";

/** The practitioner's default meeting length, falling back to the app default.
 *  Read per call rather than cached: it is one indexed lookup, and a stale value
 *  would quietly schedule a meeting at the wrong length. */
async function defaultSessionMinutes(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { defaultSessionMinutes: true },
  });
  return user?.defaultSessionMinutes ?? DEFAULT_SESSION_MINUTES;
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SessionFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** refused for an overlap — the form's live warning already says so */
  conflict?: boolean;
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

function overlapList(overlaps: Awaited<ReturnType<typeof findOverlaps>>): string {
  const fmt = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  return overlaps
    .map((o) => `${o.client.firstName} ${o.client.lastName} — ${fmt.format(o.startsAt)}`)
    .join(", ");
}

function overlapError(
  overlaps: Awaited<ReturnType<typeof findOverlaps>>,
): SessionFormState {
  const list = overlapList(overlaps);
  return {
    error: `הזמן חופף לפגישה קיימת: ${list}. ניתן לסמן "אפשר חפיפה" כדי לשמור בכל זאת.`,
    conflict: true,
  };
}

const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Where the client's following meetings in the same standing slot go when
 *  this one moves to `newLocal` ("yyyy-MM-ddTHH:mm") for `durationMinutes`.
 *  The caller has already verified the session belongs to `userId`. */
async function followerMoves(
  userId: string,
  existing: {
    id: string;
    clientId: string;
    startsAt: Date;
    parentSessionId: string | null;
    recurrenceRule: string | null;
  },
  newLocal: string,
  durationMinutes: number,
): Promise<MovedSlot[]> {
  const followers = await loadSlotFollowers(userId, existing);
  return moveFollowers(
    followers,
    existing.startsAt,
    newLocal.slice(0, 10),
    newLocal.slice(11, 16),
    durationMinutes,
  );
}

const SCOPE_SELECT = {
  id: true,
  clientId: true,
  startsAt: true,
  status: true,
  parentSessionId: true,
  recurrenceRule: true,
} as const;

/** Live check while a meeting's time is being chosen, so an overlap shows up
 *  before "שמירה" rather than as a refused save. Read-only; the save still runs
 *  its own check (including every slot of a new series), this only warns early.
 *  With applyScope "future" it also checks where the client's following
 *  meetings in the same slot would land. Times are clinic wall-clock
 *  "yyyy-MM-ddTHH:mm". */
export async function checkOverlapAction(input: {
  startLocal: string;
  endLocal: string;
  excludeId?: string;
  applyScope?: "single" | "future";
}): Promise<{ overlap: string | null }> {
  const userId = await requireUserId();
  if (!LOCAL_DT.test(input.startLocal) || !LOCAL_DT.test(input.endLocal)) {
    return { overlap: null };
  }
  const startsAt = fromZonedDateTimeLocal(input.startLocal);
  const endsAt = fromZonedDateTimeLocal(input.endLocal);
  if (!(endsAt > startsAt)) return { overlap: null };

  let moves: MovedSlot[] = [];
  if (input.applyScope === "future" && input.excludeId) {
    const existing = await db.session.findFirst({
      where: { id: input.excludeId, userId },
      select: SCOPE_SELECT,
    });
    if (existing) {
      const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
      moves = await followerMoves(userId, existing, input.startLocal, minutes);
    }
  }

  const overlaps = await findOverlaps(
    userId,
    [{ startsAt, endsAt }, ...moves],
    [...(input.excludeId ? [input.excludeId] : []), ...moves.map((m) => m.id)],
  );
  return { overlap: overlaps.length ? overlapList(overlaps) : null };
}

export type SessionScopeInfo = {
  clientName: string;
  /** "ימי שני ב-18:00" — the slot the meeting currently sits in */
  slotLabel: string;
  /** following scheduled meetings of the client in that slot */
  followers: number;
  /** this meeting starts after now */
  isFuture: boolean;
  /** future meetings of the client that "delete all future" would remove */
  futureDelete: number;
  /** future meetings kept because they hold notes/files/billing */
  futureKeep: number;
  keepReasons: string;
  /** other future meetings that "delete all future" would delete or cancel —
   *  the choice is offered only when there is at least one */
  othersAffected: number;
};

async function scopeInfo(
  userId: string,
  sess: {
    id: string;
    clientId: string;
    startsAt: Date;
    parentSessionId: string | null;
    recurrenceRule: string | null;
    client: { firstName: string; lastName: string };
  },
): Promise<SessionScopeInfo> {
  const now = new Date();
  const [followers, plan] = await Promise.all([
    loadSlotFollowers(userId, sess, now),
    loadFutureDeletePlan(userId, sess.clientId, now),
  ]);
  return {
    clientName: `${sess.client.firstName} ${sess.client.lastName}`,
    slotLabel: slotLabel(sess.startsAt),
    followers: followers.length,
    isFuture: sess.startsAt.getTime() > now.getTime(),
    futureDelete: plan.deleteIds.length,
    futureKeep: plan.keep.length,
    keepReasons: keepReasonsText(plan.keep),
    othersAffected: [...plan.deleteIds, ...plan.scheduledKeepIds].filter((x) => x !== sess.id)
      .length,
  };
}

/** Read-only: what "all of this client's meetings" would cover for a meeting —
 *  used to offer (and count) the choice in the calendar popup. */
export async function sessionScopeInfoAction(id: string): Promise<SessionScopeInfo | null> {
  const userId = await requireUserId();
  if (typeof id !== "string" || !id) return null;
  const sess = await db.session.findFirst({
    where: { id, userId },
    select: { ...SCOPE_SELECT, client: { select: { firstName: true, lastName: true } } },
  });
  return sess ? scopeInfo(userId, sess) : null;
}

export async function createSessionAction(
  _: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };

  // The form always sends a duration; this covers paths that do not, and it
  // should follow the practitioner's setting rather than a number frozen here.
  const fallbackMinutes = await defaultSessionMinutes(userId);

  const parsed = createSessionSchema.safeParse({
    clientId: formData.get("clientId") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") || String(fallbackMinutes),
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

  const fallbackMinutes = await defaultSessionMinutes(userId);

  const parsed = updateSessionSchema.safeParse({
    id: formData.get("id") ?? "",
    clientId: formData.get("clientId") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") || String(fallbackMinutes),
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
    select: SCOPE_SELECT,
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

  // "All of this client's following meetings": the client's later scheduled
  // meetings in the same standing slot move with this one — same day offset,
  // the new start time and length (e.g. Monday 18:00 → Wednesday 17:00).
  const moves =
    formData.get("applyScope") === "future"
      ? await followerMoves(userId, existing, data.startsAt, data.durationMinutes)
      : [];

  if (!data.allowOverlap) {
    const overlaps = await findOverlaps(
      userId,
      [{ startsAt, endsAt }, ...moves],
      [data.id, ...moves.map((m) => m.id)],
    );
    if (overlaps.length > 0) return overlapError(overlaps);
  }

  await db.$transaction([
    db.session.update({
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
    }),
    ...moves.map((m) =>
      db.session.update({
        where: { id: m.id, userId },
        data: { startsAt: m.startsAt, endsAt: m.endsAt },
      }),
    ),
  ]);

  // If the time changed and the session is still scheduled, refresh reminders
  const timeChanged = startsAt.getTime() !== existing.startsAt.getTime();
  if (timeChanged && existing.status === "SCHEDULED") {
    await rescheduleSessionReminders(data.id);
  }
  for (const m of moves) {
    await rescheduleSessionReminders(m.id);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/sessions/${data.id}`);
  for (const m of moves) revalidatePath(`/sessions/${m.id}`);
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

  await db.$transaction(async (tx) => {
    await tx.reminderJob.updateMany({
      where: { sessionId: { in: ids }, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await tx.session.updateMany({
      where: { userId, id: { in: keepIds } },
      data: { status: "CANCELLED" },
    });
    await keepSeriesLinked(tx, userId, deletableIds);
    await tx.session.deleteMany({ where: { userId, id: { in: deletableIds } } });
  });

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
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
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
    select: SCOPE_SELECT,
  });
  if (!existing) return { error: "פגישה לא נמצאה" };

  const client = await db.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });
  if (!client) return { error: "לקוח לא נמצא" };

  const startsAt = fromZonedDateTimeLocal(`${date}T${startTime}`);
  const endsAt = fromZonedDateTimeLocal(`${date}T${endTime}`);

  // "All of this client's following meetings": every later scheduled meeting
  // of the client in the same standing slot (same weekday and start time, or
  // the same recurring series) moves to the new start/end times — and by the
  // same number of days, if the date moved (Monday 18:00 → Wednesday 17:00).
  // Standing meetings booked one by one are not a series, so the slot is what
  // ties them together.
  const futureUpdates =
    applyScope === "future"
      ? await followerMoves(
          userId,
          existing,
          `${date}T${startTime}`,
          Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
        )
      : [];

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
    select: { id: true, clientId: true, note: { select: { id: true } } },
  });
  if (!existing) return;

  await cancelSessionReminders(id);
  await db.$transaction(async (tx) => {
    // Deleting a series' first meeting must not cut the rest loose
    await keepSeriesLinked(tx, userId, [id]);
    await tx.session.delete({ where: { id, userId } });
  });
  if (existing.note) {
    await logAudit(userId, "NOTE_DELETE", { sessionId: id, clientId: existing.clientId });
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${existing.clientId}`);
  redirect("/calendar");
}

/**
 * "Delete all of this client's future meetings" — for a client who stopped
 * coming. Only meetings that start after now are touched; of those, any that
 * hold a clinical note, an attachment, a payment record, an app invoice or a
 * Morning document are kept (and cancelled, so no reminder goes out). Past
 * meetings are never touched. Lands on the client's card with the result.
 */
export async function deleteClientFutureSessionsAction(formData: FormData) {
  const userId = await requireUserId();
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) return;

  const client = await db.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });
  if (!client) return;

  const plan = await loadFutureDeletePlan(userId, clientId);

  await db.$transaction(async (tx) => {
    await keepSeriesLinked(tx, userId, plan.deleteIds);
    if (plan.scheduledKeepIds.length) {
      await tx.session.updateMany({
        where: { userId, id: { in: plan.scheduledKeepIds } },
        data: { status: "CANCELLED" },
      });
    }
    // Reminder jobs of deleted meetings go with them (ON DELETE CASCADE)
    await tx.session.deleteMany({ where: { userId, clientId, id: { in: plan.deleteIds } } });
  });
  for (const keptId of plan.scheduledKeepIds) {
    await cancelSessionReminders(keptId);
  }
  await logAudit(userId, "SESSIONS_BULK_DELETE", { clientId });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
  const why = [...new Set(plan.keep.flatMap((k) => k.reasons))].join(",");
  const params = new URLSearchParams({
    futureDeleted: String(plan.deleteIds.length),
    futureKept: String(plan.keep.length),
    ...(why ? { keptWhy: why } : {}),
  });
  redirect(`/clients/${clientId}?${params}`);
}
