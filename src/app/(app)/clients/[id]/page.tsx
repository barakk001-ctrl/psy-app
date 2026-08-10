import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone, MapPin, Calendar as CalIcon, Pencil } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptNote } from "@/lib/crypto";
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
      morningDocuments: {
        orderBy: { docDate: "desc" },
        take: 20,
      },
      _count: { select: { sessions: true, invoices: true } },
    },
  });

  if (!client) notFound();

  const [completedCount, notedSessions] = await Promise.all([
    db.session.count({ where: { clientId: id, userId, status: "COMPLETED" } }),
    db.session.findMany({
      where: { clientId: id, userId, note: { isNot: null } },
      orderBy: { startsAt: "desc" },
      take: 20,
      include: { note: true },
    }),
  ]);

  // The clinical record: decrypted summaries, newest first
  const noteFeed = notedSessions.map((s) => {
    let text = "";
    try {
      text = decryptNote({
        contentCiphertext: s.note!.contentCiphertext,
        contentIv: s.note!.contentIv,
        contentTag: s.note!.contentTag,
      });
    } catch {
      text = "(שגיאה בפענוח הסיכום)";
    }
    return { id: s.id, startsAt: s.startsAt, status: s.status, text };
  });

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
              <b className="text-ink">{completedCount} פגישות התקיימו</b> ·{" "}
              {client._count.sessions} פגישות סה״כ · {client._count.invoices} חשבוניות
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
            <CardTitle>סיכומי פגישות</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {noteFeed.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-muted">
                עדיין אין סיכומים מתועדים — כתיבת סיכום נעשית מתוך עמוד הפגישה.
              </div>
            ) : (
              <ul className="divide-y divide-cream-200">
                {noteFeed.map((n) => (
                  <li key={n.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm font-medium text-ink">
                        {formatDateTime(n.startsAt)}
                      </span>
                      <Link
                        href={`/sessions/${n.id}`}
                        className="text-xs text-sage-600 hover:text-sage-700 shrink-0"
                      >
                        לפגישה ←
                      </Link>
                    </div>
                    <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                      {n.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {noteFeed.length === 20 && (
              <p className="px-5 py-3 text-xs text-ink-subtle border-t border-cream-200">
                מוצגים 20 הסיכומים האחרונים.
              </p>
            )}
          </CardContent>
        </Card>

        <details className="lg:col-span-3 group">
          <summary className="cursor-pointer list-none">
            <Card className="hover:border-sage-300 transition-colors">
              <CardContent className="py-4 flex items-center justify-between">
                <span className="font-display text-lg text-ink">
                  היסטוריית פגישות ({client._count.sessions})
                </span>
                <span className="text-xs text-ink-muted group-open:hidden">
                  הצגה ←
                </span>
                <span className="text-xs text-ink-muted hidden group-open:inline">
                  הסתרה ↑
                </span>
              </CardContent>
            </Card>
          </summary>
          <Card className="mt-3">
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
                          {!s.invoiceItem?.invoice && s.morningDocNumber && (
                            <>
                              {" · "}חשבונית morning{" "}
                              <span dir="ltr">{s.morningDocNumber}</span>
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
        </details>

        {client.morningDocuments.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>מסמכי morning משויכים</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-cream-200">
                {client.morningDocuments.map((d) => (
                  <li
                    key={d.id}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm text-ink">
                        {{ 400: "קבלה", 320: "חשבונית מס-קבלה", 305: "חשבונית מס" }[
                          d.docType ?? 0
                        ] ?? "מסמך"}{" "}
                        {d.number && <span dir="ltr">{d.number}</span>}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {d.docDate && formatDate(d.docDate)}
                        {d.amount && <> · {formatCurrency(d.amount.toString())}</>}
                      </div>
                    </div>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sage-600 hover:text-sage-700"
                      >
                        פתיחה ב-morning ←
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
