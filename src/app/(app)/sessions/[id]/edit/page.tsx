import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toZonedDateTimeLocal } from "@/lib/timezone";
import { SessionForm } from "@/components/sessions/session-form";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const sess = await db.session.findFirst({
    where: { id, userId },
    select: {
      id: true,
      clientId: true,
      startsAt: true,
      endsAt: true,
      location: true,
      meetingUrl: true,
      rate: true,
    },
  });
  if (!sess) notFound();

  // Get all active clients for the dropdown.
  // Also include the session's current client even if archived,
  // so the dropdown doesn't break for old sessions.
  const clients = await db.client.findMany({
    where: {
      userId,
      OR: [{ status: "ACTIVE" }, { id: sess.clientId }],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, defaultRate: true },
  });

  const clientOptions = clients.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    defaultRate: c.defaultRate ? c.defaultRate.toString() : null,
  }));

  const durationMinutes = Math.round(
    (sess.endsAt.getTime() - sess.startsAt.getTime()) / (60 * 1000),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/sessions/${sess.id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לפגישה
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">עריכת פגישה</h1>
        <p className="text-ink-muted text-sm mt-1">
          ניתן לשנות לקוח/ה, מועד, משך, מיקום ותעריף.
        </p>
      </header>
      <SessionForm
        clients={clientOptions}
        initial={{
          id: sess.id,
          clientId: sess.clientId,
          startsAt: toZonedDateTimeLocal(sess.startsAt),
          durationMinutes,
          location: sess.location,
          meetingUrl: sess.meetingUrl,
          rate: sess.rate ? sess.rate.toString() : null,
        }}
      />
    </div>
  );
}
