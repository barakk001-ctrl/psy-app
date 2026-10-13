import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { MorningDocsPanel } from "@/components/invoices/morning-docs-panel";
import { getMorningCredentials } from "@/lib/morning";
import { formatCurrency, formatDate } from "@/lib/format";
import { docTypeLabel } from "@/lib/billing-docs";

// "ב-morning" kept on one line (the hyphen is a break point before the LTR word)
const inMorning = (
  <span className="whitespace-nowrap">
    ב-<span dir="ltr">morning</span>
  </span>
);

export default async function InvoicesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const invoices = await db.invoice.findMany({
    where: { userId },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: {
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const morningConnected = !!(await getMorningCredentials(userId));
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
          <h1 className="font-display text-3xl text-ink">חשבוניות וקבלות</h1>
          {/* What this page is — and isn't (Keren asked whether it issues into morning) */}
          <p className="text-ink-muted mt-1 text-sm max-w-2xl">
            {morningConnected ? (
              <>
                ״מסמך חדש״ מפיק חשבונית מס, חשבונית מס/קבלה או קבלה {inMorning} — שם הם
                מסמכים רשמיים — והמספר והקישור נשמרים כאן.
              </>
            ) : (
              <>
                ״מסמך חדש״ מכין את המסמך ושומר טיוטה (לא מסמך מס); את המסמך הרשמי מפיקים{" "}
                {inMorning}. כדי שיופק מכאן אוטומטית, מחברים את morning ב
                <Link href="/settings" className="text-sage-600 hover:text-sage-700 hover:underline">
                  הגדרות
                </Link>
                .
              </>
            )}
            {invoices.length > 0 && (
              <span className="text-ink-subtle"> · {invoices.length} מסמכים</span>
            )}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="w-4 h-4" /> מסמך חדש
          </Button>
        </Link>
      </header>

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

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
            <h3 className="font-display text-xl text-ink">עדיין אין מסמכים</h3>
            <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">
              חשבונית או קבלה על פגישות שהתקיימו — בוחרים את הפגישות, בודקים בתצוגה המקדימה ומפיקים.
            </p>
            <Link href="/invoices/new" className="inline-block mt-5">
              <Button>
                <Plus className="w-4 h-4" /> מסמך ראשון
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-cream-200">
            {invoices.map((inv) => {
              const total = Number(inv.total);
              const paid = Number(inv.amountPaid);
              const balance = total - paid;
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
                        {inv.client.firstName} {inv.client.lastName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-ink-muted">
                          {formatDate(inv.issueDate)}
                        </span>
                        {(inv.docType == null || inv.status === "CANCELLED") && (
                          <InvoiceStatusBadge status={inv.status} />
                        )}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-medium text-ink text-sm sm:text-base">
                        {inv.docType === 330 ? "−" : ""}
                        {formatCurrency(total)}
                      </div>
                      {balance > 0 && balance !== total && (
                        <div className="text-[10px] sm:text-xs text-terracotta-600 mt-0.5">
                          יתרה: {formatCurrency(balance)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
