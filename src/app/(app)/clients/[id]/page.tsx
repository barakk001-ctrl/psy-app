import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone, MapPin, Calendar as CalIcon, Pencil } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArchiveButton } from "@/components/clients/archive-button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const client = await db.client.findFirst({
    where: { id, userId },
    include: {
      sessions: {
        orderBy: { startsAt: "desc" },
        take: 10,
        include: {
          invoiceItem: {
            include: {
              invoice: {
                select: { number: true, morningDocNumber: true },
              },
            },
          },
        },
      },
      _count: { select: { sessions: true, invoices: true } },
    },
  });

  if (!client) notFound();

  return (
    <div className="space-y-8 max-w-5xl">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לרשימת הלקוחות
      </Link>

      <header className="flex flex-wrap items-start gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center font-display text-2xl">
            {client.firstName[0]}
            {client.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl text-ink">
                {client.firstName} {client.lastName}
              </h1>
              {client.status === "ARCHIVED" && (
                <span className="text-[10px] uppercase tracking-wider bg-cream-200 text-ink-muted px-2 py-0.5 rounded-full">
                  מאוחסן/ת
                </span>
              )}
            </div>
            <p className="text-sm text-ink-muted mt-1">
              {client._count.sessions} פגישות · {client._count.invoices} חשבוניות
              {client.intakeDate && <> · נפתח תיק ב-{formatDate(client.intakeDate)}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ArchiveButton
            clientId={client.id}
            clientName={`${client.firstName} ${client.lastName}`}
            archived={client.status === "ARCHIVED"}
          />
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-4 h-4" />
              עריכה
            </Button>
          </Link>
          {client.status !== "ARCHIVED" && (
            <>
              <Link href={`/invoices/new?clientId=${client.id}`}>
                <Button variant="secondary" size="sm">
                  חשבונית חדשה
                </Button>
              </Link>
              <Link href={`/sessions/new?clientId=${client.id}`}>
                <Button size="sm">
                  <CalIcon className="w-4 h-4" />
                  פגישה חדשה
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>פרטי קשר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2 text-ink-soft">
                <Phone className="w-4 h-4 text-ink-subtle shrink-0" />
                <span dir="ltr">{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-ink-soft">
                <Mail className="w-4 h-4 text-ink-subtle shrink-0" />
                <span dir="ltr">{client.email}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2 text-ink-soft">
                <MapPin className="w-4 h-4 text-ink-subtle shrink-0 mt-0.5" />
                <span>{client.address}</span>
              </div>
            )}
            {client.idNumber && (
              <div className="text-ink-muted text-xs pt-2 border-t border-cream-200">
                ת.ז: <span dir="ltr">{client.idNumber}</span>
              </div>
            )}
            {client.dateOfBirth && (
              <div className="text-ink-muted text-xs">
                ת. לידה: {formatDate(client.dateOfBirth)}
              </div>
            )}
            {client.defaultRate && (
              <div className="text-ink-muted text-xs">
                תעריף: {formatCurrency(client.defaultRate.toString())}
              </div>
            )}
            {client.generalNotes && (
              <div className="pt-3 border-t border-cream-200">
                <p className="text-xs text-ink-muted whitespace-pre-wrap leading-relaxed">
                  {client.generalNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>היסטוריית פגישות</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {client.sessions.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-muted">
                עדיין אין פגישות עבור לקוח זה.
              </div>
            ) : (
              <ul className="divide-y divide-cream-200">
                {client.sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="px-5 py-3 flex items-center justify-between hover:bg-cream-100/60 transition-colors"
                    >
                      <div>
                        <div className="text-sm text-ink">{formatDateTime(s.startsAt)}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {s.status === "COMPLETED" && "התקיימה"}
                          {s.status === "SCHEDULED" && "מתוכננת"}
                          {s.status === "CANCELLED" && "בוטלה"}
                          {s.status === "NO_SHOW" && "לא הופיע/ה"}
                          {s.invoiceItem?.invoice && (
                            <>
                              {" · "}חשבונית #
                              {String(s.invoiceItem.invoice.number).padStart(4, "0")}
                              {s.invoiceItem.invoice.morningDocNumber && (
                                <>
                                  {" · "}קבלה{" "}
                                  <span dir="ltr">
                                    {s.invoiceItem.invoice.morningDocNumber}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {s.rate && (
                        <span className="text-xs text-ink-muted">
                          {formatCurrency(s.rate.toString())}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
