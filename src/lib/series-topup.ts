// Keeps open-ended (קבוע) recurring series rolling: when a series has less
// than ~2 months of future instances left, more are appended automatically.
// Called from the reminders cron.

import { db } from "@/lib/db";
import {
  isOpenEndedRule,
  ruleInterval,
  seriesSlots,
  shouldTopUpSeries,
} from "@/lib/recurrence";
import { scheduleSessionReminders } from "@/lib/reminders";
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
    },
  });

  let created = 0;
  for (const p of parents) {
    if (!isOpenEndedRule(p.recurrenceRule)) continue;

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
    const slots = seriesSlots(
      toZonedDateTimeLocal(last.startsAt),
      durationMs,
      interval,
      EXTEND_BY + 1,
    ).slice(1);

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
