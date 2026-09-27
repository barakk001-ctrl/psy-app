import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone, MapPin, Calendar as CalIcon, Pencil } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptNote } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientStatusToggle } from "@/components/clients/client-status-toggle";
import { SessionList } from "@/components/clients/session-list";
import { PdfButton } from "@/components/ui/pdf-button";
import { tookPlace } from "@/lib/income";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { KEEP_REASON_LABELS, type KeepReason } from "@/lib/bulk-delete";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ futureDeleted?: string; futureKept?: string; keptWhy?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Result of "delete all of this client's future meetings" (session page / popup)
  const bulk =
    sp.futureDeleted !== undefined
      ? {
          deleted: Number(sp.futureDeleted) || 0,
          kept: Number(sp.futureKept) || 0,
          why: (sp.keptWhy ?? "")
            .split(",")
            .filter((r): r is KeepReason => r in KEEP_REASON_LABELS)
            .map((r) => KEEP_REASON_LABELS[r])
            .join(", "),
        }
      : null;
  const session = await auth();
  const userId = session!.user.id;

  const client = await db.client.findFirst({
    where: { id, userId },
    include: {
      morningDocuments: {
        orderBy: { docDate: "desc" },
        take: 20,
      },
      sessionFiles: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          fileName: true,
          size: true,
          createdAt: true,
          sessionId: true,
        },
      },
      _count: { select: { sessions: true, invoices: true } },
    },
  });

  if (!client) notFound();

  const [allSessions, notedSessions] = await Promise.all([
    db.session.findMany({
      where: { clientId: id, userId },
      orderBy: { startsAt: "desc" },
      include: {
        invoiceItem: {
          include: {
            invoice: {
              select: { number: true, morningDocNumber: true },
            },
          },
        },
        note: { select: { id: true } },
      },
    }),
    db.session.findMany({
      // The record includes documented meetings AND cancellations
      where: {
        clientId: id,
        userId,
        OR: [{ note: { isNot: null } }, { status: "CANCELLED" }],
      },
      orderBy: { startsAt: "desc" },
      take: 20,
      include: { note: true },
    }),
  ]);

  // The clinical record: decrypted summaries + cancellations, newest first
  const noteFeed = notedSessions.map((s) => {
    let text = "";
    if (s.note) {
      try {
        text = decryptNote({
          contentCiphertext: s.note.contentCiphertext,
          contentIv: s.note.contentIv,
          contentTag: s.note.contentTag,
        });
      } catch {
        text = "(שגיאה בפענוח הסיכום)";
      }
    }
    return { id: s.id, startsAt: s.startsAt, cancelled: s.status === "CANCELLED", text };
  });
  // Meetings split by what actually happened (the old single "history" list
  // mixed booked future meetings in with past ones)
  const now = new Date();
  const upcoming = allSessions
    .filter((s) => s.status === "SCHEDULED" && s.startsAt.getTime() > now.getTime())
    .reverse(); // soonest first
  const past = allSessions.filter((s) => tookPlace(s, now)); // newest first
  const cancelled = allSessions.filter(
    (s) => s.status === "CANCELLED" || s.status === "NO_SHOW",
  );
  const summariesCount = noteFeed.filter((n) => n.text).length;

  // One entry per record view, not per note — the feed is a single act of access
  if (noteFeed.some((n) => n.text)) {
    await logAudit(userId, "RECORD_VIEW", { clientId: id });
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לרשימת הלקוחות
      </Link>

      {bulk && (
        <div
          role="status"
          className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-ink-soft space-y-2"
        >
          <p className="font-medium text-ink">
            {bulk.deleted === 1
              ? "נמחקה פגישה עתידית אחת."
              : `נמחקו ${bulk.deleted} פגישות עתידיות.`}{" "}
            פגישות שכבר עברו נשארו ברשומה.
          </p>
          {bulk.kept > 0 && (
            <p>
              {bulk.kept === 1
                ? `פגישה עתידית אחת לא נמחקה כי יש בה ${bulk.why || "רשומות"} — היא סומנה כמבוטלת ונשמרה.`
                : `${bulk.kept} פגישות עתידיות לא נמחקו כי יש בהן ${bulk.why || "רשומות"} — הן סומנו כמבוטלות ונשמרו.`}
            </p>
          )}
          {client.status === "ACTIVE" && (
            <div className="flex flex-wrap items-center gap-2">
              <span>אם הטיפול הסתיים, אפשר לסמן את התיק כלא פעיל:</span>
              <ClientStatusToggle clientId={client.id} status={client.status} />
            </div>
          )}
        </div>
      )}

      <header className="flex flex-wrap items-start gap-6 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center font-display text-2xl">
            {client.firstName[0]}
            {client.lastName[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl text-ink">
                {client.firstName} {client.lastName}
              </h1>
              <ClientStatusToggle clientId={client.id} status={client.status} />
            </div>
            <p className="text-sm text-ink-muted mt-1">
              <b className="text-ink">{past.length} פגישות התקיימו</b>
              {upcoming.length > 0 && <> · {upcoming.length} עתידיות</>} ·{" "}
              {client._count.sessions} פגישות סה״כ · {client._count.invoices} חשבוניות
              {client.intakeDate && <> · נפתח תיק ב-{formatDate(client.intakeDate)}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-4 h-4" />
              עריכה
            </Button>
          </Link>
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
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>סיכומי פגישות</CardTitle>
            {summariesCount > 0 && (
              <PdfButton
                url={`/api/clients/${client.id}/summaries`}
                fileName={`סיכומי פגישות - ${client.firstName} ${client.lastName}.pdf`.trim()}
                label="ייצוא סיכומים ל-PDF"
              />
            )}
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
                      <span className="text-sm font-medium text-ink inline-flex items-center gap-2">
                        {formatDateTime(n.startsAt)}
                        {n.cancelled && (
                          <span className="rounded-full bg-cream-200 text-ink-muted text-[10px] px-2 py-0.5">
                            בוטלה
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/sessions/${n.id}`}
                        className="text-xs text-sage-600 hover:text-sage-700 shrink-0"
                      >
                        לפגישה ←
                      </Link>
                    </div>
                    {n.text ? (
                      <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                        {n.text}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-subtle">הפגישה בוטלה.</p>
                    )}
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

        <div className="lg:col-span-3 space-y-3">
          <SessionList
            title="פגישות עתידיות"
            sessions={upcoming}
            emptyText="אין פגישות עתידיות ביומן."
            defaultOpen
          />
          <SessionList
            title="פגישות שהתקיימו"
            sessions={past}
            emptyText="עדיין אין פגישות שהתקיימו."
            showFlags
          />
          {cancelled.length > 0 && (
            <SessionList
              title="בוטלו / לא התקיימו"
              sessions={cancelled}
              emptyText=""
              muted
            />
          )}
        </div>

        {client.sessionFiles.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>מסמכים</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-cream-200">
                {client.sessionFiles.map((f) => (
                  <li
                    key={f.id}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-ink hover:text-sage-700 truncate block"
                      >
                        {f.fileName}
                      </a>
                      <div className="text-xs text-ink-subtle mt-0.5">
                        {formatDate(f.createdAt)} ·{" "}
                        {f.size < 1024 * 1024
                          ? `${Math.round(f.size / 1024)}KB`
                          : `${(f.size / (1024 * 1024)).toFixed(1)}MB`}
                      </div>
                    </div>
                    <Link
                      href={`/sessions/${f.sessionId}`}
                      className="text-xs text-sage-600 hover:text-sage-700 shrink-0"
                    >
                      לפגישה ←
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
