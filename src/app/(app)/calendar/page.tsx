import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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

  const sessions = await db.session.findMany({
    where: {
      userId,
      startsAt: { gte: rangeStart, lte: rangeEnd },
      status: { not: "CANCELLED" },
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const events: EventInput[] = sessions.map((s) => ({
    id: s.id,
    title: `${s.client.firstName} ${s.client.lastName}`,
    start: s.startsAt.toISOString(),
    end: s.endsAt.toISOString(),
    extendedProps: { status: s.status, location: s.location },
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">יומן</h1>
          <p className="text-ink-muted mt-1 text-sm">
            לחץ/י על משבצת ריקה לקביעת פגישה. גרור/י כדי לשנות זמן.
          </p>
        </div>
        <Link href="/sessions/new">
          <Button>
            <Plus className="w-4 h-4" /> פגישה חדשה
          </Button>
        </Link>
      </header>

      <CalendarView events={events} />
    </div>
  );
}
