import { requireDocumentsPage } from "@/lib/features-server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncomeDocuments } from "@/components/invoices/income-documents";
import { ImportedDocsPanel } from "@/components/invoices/imported-docs-panel";
import { DocKindSquares } from "@/components/invoices/doc-kind-squares";
import { formatCurrency, formatDate } from "@/lib/format";
import { clinicDay } from "@/lib/billing-doc-data";
import { LISTED_DOCUMENT, draftsWhere, parseDocListFilters } from "@/lib/income-doc-list";
import { loadDocMonths, loadFilteredDocuments } from "@/lib/income-doc-rows";

export const metadata = { title: "מסמכי הכנסות — מרפאה אישית" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; from?: string; to?: string; type?: string; status?: string }>;
}) {
  // Hidden until documents can be issued (src/lib/features.ts)
  requireDocumentsPage();
  const session = await auth();
  const userId = session!.user.id;
  const filters = parseDocListFilters(await searchParams);
  const today = clinicDay(new Date());

  // Both tabs' lists come together, so switching between them is instant
  const [documents, drafts, draftCount, documentCount] = await Promise.all([
    loadFilteredDocuments(userId, filters, today),
    loadDocMonths(draftsWhere(userId)),
    db.invoice.count({ where: draftsWhere(userId) }),
    db.invoice.count({ where: { userId, ...LISTED_DOCUMENT } }),
  ]);

  const owner = await db.user.findUnique({
    where: { id: userId },
    select: { vatLiable: true },
  });
  // Documents imported from morning before 2026-11-08 and never assigned
  const unassignedDocs = await db.morningDocument.findMany({
    where: { userId, clientId: null },
    orderBy: { docDate: "desc" },
    take: 50,
  });
  const clientOptions = unassignedDocs.length
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
          {/* What this page is — and isn't */}
          <p className="text-ink-muted mt-1 text-sm max-w-2xl">
            מסמך חדש מכין את המסמך ושומר טיוטה (עדיין לא מסמך מס). הפקה מתוך האפליקציה
            תגיע בקרוב; בינתיים, מסמך שהופק במקום אחר נרשם כאן עם המספר שלו.
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

      {unassignedDocs.length > 0 && (
        <ImportedDocsPanel
          docs={unassignedDocs.map((d) => ({
            id: d.id,
            number: d.number,
            docType: d.docType,
            docDate: d.docDate ? formatDate(d.docDate) : null,
            amount: d.amount ? formatCurrency(d.amount.toString()) : null,
            clientNameOnDoc: d.morningClientName,
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
