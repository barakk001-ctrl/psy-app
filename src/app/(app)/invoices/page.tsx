import Link from "next/link";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncomeDocFilters } from "@/components/invoices/income-doc-filters";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { MorningDocsPanel } from "@/components/invoices/morning-docs-panel";
import { DocKindSquares } from "@/components/invoices/doc-kind-squares";
import { getMorningCredentials } from "@/lib/morning";
import { formatCurrency, formatDate } from "@/lib/format";
import { documentClientName, docTypeLabel } from "@/lib/billing-docs";
import { clinicDay } from "@/lib/billing-doc-data";
import {
  docListHref,
  docListWhere,
  draftsWhere,
  groupByMonth,
  isCreditNote,
  parseDocListFilters,
} from "@/lib/income-doc-list";
import { cn } from "@/lib/utils";

// "ב-morning" kept on one line (the hyphen is a break point before the LTR word)
const inMorning = (
  <span className="whitespace-nowrap">
    ב-<span dir="ltr">morning</span>
  </span>
);

export const metadata = { title: "מסמכי הכנסות — מרפאה אישית" };

/** Enough for years of a solo practice; a shorter period or a filter narrows it. */
const MAX_ROWS = 500;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; from?: string; to?: string; type?: string; status?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const filters = parseDocListFilters(await searchParams);
  const today = clinicDay(new Date());

  const [invoices, draftCount, documentCount] = await Promise.all([
    db.invoice.findMany({
      where: docListWhere(userId, filters, today),
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      take: MAX_ROWS,
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
    }),
    db.invoice.count({ where: draftsWhere(userId) }),
    db.invoice.count({ where: { userId, OR: [{ docType: null }, { morningDocNumber: { not: null } }] } }),
  ]);
  const months = groupByMonth(invoices, (inv) => clinicDay(inv.issueDate));
  const drafts = filters.view === "drafts";
  const tabs = [
    { key: "documents", label: `מסמכי הכנסות (${documentCount})`, href: docListHref({ ...filters, view: "documents" }) },
    { key: "drafts", label: `טיוטות מסמכי הכנסות (${draftCount})`, href: docListHref({ ...filters, view: "drafts" }) },
  ];

  const morningConnected = !!(await getMorningCredentials(userId));
  const owner = await db.user.findUnique({
    where: { id: userId },
    select: { vatLiable: true },
  });
  const unassignedDocs = morningConnected
    ? await db.morningDocument.findMany({
        where: { userId, clientId: null },
        orderBy: { docDate: "desc" },
        take: 50,
      })
    : [];
  const clientOptions = morningConnected
    ? (
        await db.client.findMany({
          // Inactive clients too (listed after the active ones)
          where: { userId },
          orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      ).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">מסמכי הכנסות</h1>
          {/* What this page is — and isn't (Keren asked whether it issues into morning) */}
          <p className="text-ink-muted mt-1 text-sm max-w-2xl">
            {morningConnected ? (
              <>
                מסמך חדש מפיק חשבונית מס, חשבונית מס/קבלה או קבלה {inMorning} — שם הם
                מסמכים רשמיים — והמספר והקישור נשמרים כאן.
              </>
            ) : (
              <>
                מסמך חדש מכין את המסמך ושומר טיוטה (לא מסמך מס); את המסמך הרשמי מפיקים{" "}
                {inMorning}. כדי שיופק מכאן אוטומטית, מחברים את morning ב
                <Link href="/settings" className="text-sage-600 hover:text-sage-700 hover:underline">
                  הגדרות
                </Link>
                .
              </>
            )}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>מסמך חדש</CardTitle>
        </CardHeader>
        <CardContent>
          <DocKindSquares vatLiable={!!owner?.vatLiable} />
        </CardContent>
      </Card>

      {morningConnected && (
        <MorningDocsPanel
          docs={unassignedDocs.map((d) => ({
            id: d.id,
            number: d.number,
            docType: d.docType,
            docDate: d.docDate ? formatDate(d.docDate) : null,
            amount: d.amount ? formatCurrency(d.amount.toString()) : null,
            morningClientName: d.morningClientName,
            url: d.url,
          }))}
          clients={clientOptions}
        />
      )}

      <div className="space-y-3">
        <div className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={filters.view === t.key ? "page" : undefined}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                filters.view === t.key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {!drafts && <IncomeDocFilters key={docListHref(filters)} filters={filters} />}
      </div>

      {months.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
            <h2 className="font-display text-xl text-ink">
              {drafts ? "אין טיוטות" : documentCount > 0 ? "אין מסמכים לפי הסינון הזה" : "עדיין אין מסמכים"}
            </h2>
            <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">
              {drafts
                ? "מסמך שנשמר ב״שמירה כטיוטה״ מופיע כאן עד שמפיקים אותו."
                : documentCount > 0
                  ? "אפשר לשנות את התקופה, הסוג או הסטטוס."
                  : "חשבונית או קבלה על פגישות שהתקיימו — בוחרים למעלה את סוג המסמך, מסמנים את הפגישות, בודקים בתצוגה המקדימה ומפיקים."}
            </p>
          </CardContent>
        </Card>
      ) : (
        months.map((m) => (
          <section key={m.key} aria-labelledby={`month-${m.key}`} className="space-y-2">
            <h2 id={`month-${m.key}`} className="font-display text-lg text-ink">
              {m.label}
            </h2>
            <Card>
              <ul className="divide-y divide-cream-200">
                {m.rows.map((inv) => {
                  const total = Number(inv.total);
                  const paid = Number(inv.amountPaid);
                  const balance = total - paid;
                  const credit = isCreditNote(inv.docType);
                  return (
                    <li key={inv.id}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 hover:bg-cream-100/60 transition-colors"
                      >
                        <div className="shrink-0 w-20 sm:w-28">
                          {inv.docType != null ? (
                            <>
                              <div className="text-[11px] sm:text-xs text-ink-muted leading-tight">
                                {docTypeLabel(inv.docType)}
                              </div>
                              <div className="font-display text-base sm:text-lg text-ink">
                                {inv.morningDocNumber ?? (
                                  <span className="text-sm text-ink-muted font-sans font-medium">טיוטה</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="font-display text-base sm:text-lg text-ink">
                              #{String(inv.number).padStart(4, "0")}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-ink truncate text-sm sm:text-base">
                            {inv.docClientName || inv.clientId ? documentClientName(inv) : "ללא שם עדיין"}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] sm:text-xs text-ink-muted">
                              {formatDate(inv.issueDate)}
                            </span>
                            {!drafts && !credit && <InvoiceStatusBadge status={inv.status} />}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <div className="font-medium text-ink text-sm sm:text-base">
                            {credit ? "−" : ""}
                            {formatCurrency(total, inv.currency)}
                          </div>
                          {!credit && balance > 0 && balance !== total && (
                            <div className="text-[10px] sm:text-xs text-terracotta-600 mt-0.5">
                              יתרה: {formatCurrency(balance, inv.currency)}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}
      {invoices.length === MAX_ROWS && (
        <p className="text-xs text-ink-muted text-center">מוצגים {MAX_ROWS} המסמכים האחרונים. אפשר לצמצם בסינון.</p>
      )}
    </div>
  );
}
