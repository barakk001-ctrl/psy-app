import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SessionForm } from "@/components/sessions/session-form";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; clientId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const clients = await db.client.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, defaultRate: true },
  });

  // Serialize Decimal → string for client
  const clientOptions = clients.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    defaultRate: c.defaultRate ? c.defaultRate.toString() : null,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה ליומן
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">פגישה חדשה</h1>
      </header>
      <SessionForm
        clients={clientOptions}
        defaults={{ startsAt: params.start, clientId: params.clientId }}
      />
    </div>
  );
}
