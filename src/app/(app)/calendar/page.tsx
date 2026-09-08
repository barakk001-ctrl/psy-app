import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMeetingTypeNames, getMeetingTypeColorMap } from "@/lib/meeting-types";
import { toZonedDateTimeLocal } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar/calendar-view";
import type { EventInput } from "@fullcalendar/core";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 60);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 180);

  const [sessions, clients, meetingTypes, typeColors] = await Promise.all([
    db.session.findMany({
      where: {
        userId,
        startsAt: { gte: rangeStart, lte: rangeEnd },
        status: { not: "CANCELLED" },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.client.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    getMeetingTypeNames(userId),
    getMeetingTypeColorMap(userId),
  ]);

  const events: EventInput[] = sessions.map((s) => ({
    id: s.id,
    title: `${s.client.firstName} ${s.client.lastName}`,
    start: s.startsAt.toISOString(),
    end: s.endsAt.toISOString(),
    extendedProps: {
      status: s.status,
      location: s.location,
      clientId: s.clientId,
      treatmentType: s.treatmentType,
      startLocal: toZonedDateTimeLocal(s.startsAt),
      endLocal: toZonedDateTimeLocal(s.endsAt),
      inSeries: !!(s.parentSessionId || s.recurrenceRule),
    },
  }));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Compact header — the month grid below must fit the viewport whole */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl text-ink">יומן</h1>
          <p className="text-ink-muted text-xs sm:text-sm hidden sm:block">
            לחץ/י על משבצת ריקה לקביעת פגישה. גרור/י כדי לשנות זמן.
          </p>
        </div>
        <Link href="/sessions/new">
          <Button size="sm">
            <Plus className="w-4 h-4" /> פגישה חדשה
          </Button>
        </Link>
      </header>

      <CalendarView
        events={events}
        clients={clients.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
        }))}
        meetingTypes={meetingTypes}
        typeColors={typeColors}
      />
    </div>
  );
}
