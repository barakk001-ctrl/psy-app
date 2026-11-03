import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncomeDocuments } from "@/components/invoices/income-documents";
import { MorningDocsPanel } from "@/components/invoices/morning-docs-panel";
import { DocKindSquares } from "@/components/invoices/doc-kind-squares";
import { getMorningCredentials } from "@/lib/morning";
import { formatCurrency, formatDate } from "@/lib/format";
import { clinicDay } from "@/lib/billing-doc-data";
import { draftsWhere, parseDocListFilters } from "@/lib/income-doc-list";
import { loadDocMonths, loadFilteredDocuments } from "@/lib/income-doc-rows";

// "ב-morning" kept on one line (the hyphen is a break point before the LTR word)
const inMorning = (
  <span className="whitespace-nowrap">
    ב-<span dir="ltr">morning</span>
  </span>
);

export const metadata = { title: "מסמכי הכנסות — מרפאה אישית" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; from?: string; to?: string; type?: string; status?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const filters = parseDocListFilters(await searchParams);
  const today = clinicDay(new Date());

  // Both tabs' lists come together, so switching between them is instant
  const [documents, drafts, draftCount, documentCount] = await Promise.all([
    loadFilteredDocuments(userId, filters, today),
    loadDocMonths(draftsWhere(userId)),
    db.invoice.count({ where: draftsWhere(userId) }),
    db.invoice.count({ where: { userId, OR: [{ docType: null }, { morningDocNumber: { not: null } }] } }),
  ]);

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

      <div>
        <IncomeDocuments
          filters={filters}
          documents={documents}
          drafts={drafts}
          documentCount={documentCount}
          draftCount={draftCount}
        />
      </div>
    </div>
  );
}
