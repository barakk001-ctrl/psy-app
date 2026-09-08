import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildIcs, type CalendarNameMode } from "@/lib/ics";

// Private ICS feed: the long random token in the URL is the entire
// authorization (like the inbox token). Google Calendar polls this endpoint.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, calendarNameMode: true },
  });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Recent past + all future; cancelled events are included as CANCELLED so
  // Google removes them from views instead of leaving stale entries.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await db.session.findMany({
    where: { userId: user.id, startsAt: { gte: since } },
    orderBy: { startsAt: "asc" },
    take: 1000,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      treatmentType: true,
      location: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const ics = buildIcs(
    sessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      treatmentType: s.treatmentType,
      location: s.location,
      clientFirstName: s.client.firstName,
      clientLastName: s.client.lastName,
    })),
    (user.calendarNameMode as CalendarNameMode) ?? "FIRST",
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'attachment; filename="merapa.ics"',
    },
  });
}
