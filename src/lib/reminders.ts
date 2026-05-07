import { db } from "@/lib/db";

/**
 * Default reminder lead times. The cron will only send reminders that:
 *   - have a scheduledFor in the past, AND
 *   - belong to a session that is still SCHEDULED, AND
 *   - target a client that has an email.
 */
export const REMINDER_LEAD_TIMES_HOURS = [24, 1] as const;

/**
 * Schedule reminder jobs for a session. Idempotent: if any pending jobs already
 * exist for this session, they are kept. We only insert ones that don't exist yet.
 *
 * Skips:
 *   - Lead times that have already passed (e.g., session is in 30 minutes — no 1h reminder)
 *   - Sessions whose start time is in the past
 */
export async function scheduleSessionReminders(sessionId: string): Promise<void> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      startsAt: true,
      status: true,
      client: { select: { email: true } },
    },
  });
  if (!session) return;
  if (session.status !== "SCHEDULED") return;
  if (!session.client.email) return; // nowhere to send the email

  const now = Date.now();
  if (session.startsAt.getTime() <= now) return;

  const existing = await db.reminderJob.findMany({
    where: { sessionId, channel: "EMAIL", status: "PENDING" },
    select: { scheduledFor: true },
  });
  const existingTimes = new Set(existing.map((e) => e.scheduledFor.getTime()));

  const toCreate = REMINDER_LEAD_TIMES_HOURS
    .map((hours) => new Date(session.startsAt.getTime() - hours * 60 * 60 * 1000))
    .filter((d) => d.getTime() > now)
    .filter((d) => !existingTimes.has(d.getTime()));

  if (toCreate.length === 0) return;

  await db.reminderJob.createMany({
    data: toCreate.map((scheduledFor) => ({
      userId: session.userId,
      sessionId: session.id,
      channel: "EMAIL" as const,
      scheduledFor,
    })),
  });
}

/**
 * Cancel all pending reminders for a session (e.g., when the session is cancelled
 * or rescheduled). Doesn't delete — sets status to CANCELLED to keep the audit trail.
 */
export async function cancelSessionReminders(sessionId: string): Promise<void> {
  await db.reminderJob.updateMany({
    where: { sessionId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

/**
 * Convenience: cancel any existing pending reminders and schedule fresh ones.
 * Used after rescheduling.
 */
export async function rescheduleSessionReminders(sessionId: string): Promise<void> {
  await cancelSessionReminders(sessionId);
  await scheduleSessionReminders(sessionId);
}
