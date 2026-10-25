// Keeps open-ended (קבוע) recurring series rolling: when a series has less
// than ~2 months of future instances left, more are appended automatically.
// Called from the hourly maintenance (and the reminders cron).
//
// What an account gets depends on its subscription (scheduling-window.ts):
// paid and exempt accounts as usual; a free-trial account only up to its
// rolling 30-day window (so its series grow a day at a time, and normally once
// it subscribes); an expired account nothing at all until it is renewed.

import { db } from "@/lib/db";
import {
  isOpenEndedRule,
  ruleInterval,
  seriesSlots,
  shouldTopUpSeries,
} from "@/lib/recurrence";
import { scheduleSessionReminders } from "@/lib/reminders";
import { schedulingWindow, slotsInWindow, topUpPolicy } from "@/lib/scheduling-window";
import { SUBSCRIPTION_FIELD_SELECT, getSubscriptionState } from "@/lib/subscription";
import { toZonedDateTimeLocal } from "@/lib/timezone";

const EXTEND_BY = 18; // instances appended per extension

export async function topUpOpenEndedSeries(): Promise<number> {
  const now = new Date();

  const parents = await db.session.findMany({
    // An inactive client's series never grows (shouldTopUpSeries checks it too)
    where: {
      recurrenceRule: { not: null },
      parentSessionId: null,
      client: { status: "ACTIVE" },
    },
    select: {
      id: true,
      userId: true,
      clientId: true,
      recurrenceRule: true,
      startsAt: true,
      endsAt: true,
      location: true,
      meetingUrl: true,
      rate: true,
      treatmentType: true,
      client: { select: { status: true } },
      user: { select: SUBSCRIPTION_FIELD_SELECT },
    },
  });

  let created = 0;
  for (const p of parents) {
    if (!isOpenEndedRule(p.recurrenceRule)) continue;

    const sub = getSubscriptionState(p.user, now);
    const policy = topUpPolicy(sub);
    if (policy === "none") continue;

    const seriesFilter = { OR: [{ id: p.id }, { parentSessionId: p.id }] };

    const aliveFuture = await db.session.count({
      where: { ...seriesFilter, status: "SCHEDULED", startsAt: { gt: now } },
    });
    const last = await db.session.findFirst({
      where: seriesFilter,
      orderBy: { startsAt: "desc" },
      select: { startsAt: true },
    });
    if (
      !last ||
      !shouldTopUpSeries(
        {
          recurrenceRule: p.recurrenceRule,
          clientStatus: p.client.status,
          aliveFutureCount: aliveFuture,
          lastStartsAt: last.startsAt,
        },
        now,
      )
    ) {
      continue;
    }

    const interval = ruleInterval(p.recurrenceRule!);
    const durationMs = p.endsAt.getTime() - p.startsAt.getTime();

    // Continue the cadence from the last instance, wall-clock stable
    const next = seriesSlots(
      toZonedDateTimeLocal(last.startsAt),
      durationMs,
      interval,
      EXTEND_BY + 1,
    ).slice(1);
    const slots = policy === "window" ? slotsInWindow(next, schedulingWindow(sub, now)) : next;

    for (const slot of slots) {
      const s = await db.session.create({
        data: {
          userId: p.userId,
          clientId: p.clientId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          location: p.location,
          meetingUrl: p.meetingUrl,
          rate: p.rate ?? undefined,
          treatmentType: p.treatmentType,
          parentSessionId: p.id,
        },
      });
      await scheduleSessionReminders(s.id);
      created++;
    }
  }
  return created;
}
