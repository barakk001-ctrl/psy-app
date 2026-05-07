import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const [clients, sessions] = await Promise.all([
    db.client.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.session.findMany({
      where: {
        userId,
        status: "COMPLETED",
        invoiceItem: null,
      },
      orderBy: { startsAt: "desc" },
      select: { id: true, clientId: true, startsAt: true, rate: true },
    }),
  ]);

  // Group sessions by client for the form
  const sessionsByClient: Record<
    string,
    { id: string; clientId: string; startsAt: string; rate: string | null }[]
  > = {};
  for (const s of sessions) {
    if (!sessionsByClient[s.clientId]) sessionsByClient[s.clientId] = [];
    sessionsByClient[s.clientId].push({
      id: s.id,
      clientId: s.clientId,
      startsAt: s.startsAt.toISOString(),
      rate: s.rate ? s.rate.toString() : null,
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לרשימת החשבוניות
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">חשבונית חדשה</h1>
        <p className="text-ink-muted text-sm mt-1">
          סמנו פגישות שכבר התקיימו, או הוסיפו שורות חיוב מותאמות.
        </p>
      </header>
      <InvoiceForm
        clients={clients}
        sessionsByClient={sessionsByClient}
        defaults={{ clientId: params.clientId }}
      />
    </div>
  );
}
