import Link from "next/link";
import { FileOutput } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PdfButton } from "@/components/ui/pdf-button";
import { ExpenseUpload } from "@/components/expenses/expense-upload";
import { ViewTabs } from "@/components/ui/view-tabs";
import { clinicDay } from "@/lib/billing-doc-data";
import { decryptSecret } from "@/lib/crypto";
import { expenseDocTypeLabel, expenseMonthAgorot, monthTotalAgorot } from "@/lib/expenses";
import { formatDocMoney, parseAgorot } from "@/lib/billing-docs";
import { formatDate } from "@/lib/format";
import { groupByMonth } from "@/lib/income-doc-list";

export const metadata = { title: "מסמכי הוצאות — מרפאה אישית" };

function fileName(ciphertext: string): string {
  try {
    return decryptSecret(ciphertext);
  } catch {
    return "קובץ";
  }
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const drafts = (await searchParams).view === "drafts";

  // Both tabs' lists come together, so switching between them is instant
  const [approvedRows, draftRows] = await Promise.all([
    db.expense.findMany({
      where: { userId, status: "APPROVED" },
      orderBy: [{ docDate: "desc" }, { createdAt: "desc" }],
    }),
    db.expense.findMany({ where: { userId, status: "DRAFT" }, orderBy: [{ createdAt: "desc" }] }),
  ]);
  const shape = (e: (typeof approvedRows)[number]) => ({
    ...e,
    name: fileName(e.nameCiphertext),
    amountAgorot: parseAgorot(e.amount?.toString() ?? "0") ?? 0,
    day: clinicDay(e.docDate ?? e.createdAt),
  });
  const approved = approvedRows.map(shape);
  const shapedDrafts = draftRows.map(shape);
  const months = groupByMonth(approved, (e) => e.day);

  const row = (e: ReturnType<typeof shape>) => (
    <li key={e.id} className="flex items-center gap-2 pe-3 sm:pe-4 hover:bg-cream-100/60 transition-colors">
      <Link href={`/expenses/${e.id}`} className="flex-1 min-w-0 flex items-center gap-3 px-4 sm:px-5 py-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate text-sm sm:text-base">{e.supplier || e.name}</div>
          <div className="text-xs text-ink-muted mt-0.5 truncate">
            {expenseDocTypeLabel(e.docType)}
            {e.docNumber ? ` ${e.docNumber}` : ""} · {formatDate(e.docDate ?? e.createdAt)}
          </div>
        </div>
        {e.amount != null && (
          <div className="font-medium text-ink text-sm sm:text-base shrink-0">
            {formatDocMoney(expenseMonthAgorot({ docType: e.docType, amountAgorot: e.amountAgorot }))}
          </div>
        )}
      </Link>
      <PdfButton url={`/api/expenses/${e.id}?download=1`} fileName={e.name} label="הורדה" />
    </li>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">מסמכי הוצאות</h1>
        <p className="text-ink-muted mt-1 text-sm max-w-2xl">
          מעלים את המסמך, ממלאים את הפרטים ומאשרים. הקבצים נשמרים מוצפנים.
        </p>
      </header>

      <ExpenseUpload />

      <div>
        <ViewTabs
          active={drafts ? "drafts" : "approved"}
          tabs={[
            {
              key: "approved",
              href: "/expenses",
              label: `מסמכים קיימים (${approved.length})`,
              panel: (
                <div className="mt-6 space-y-6">
                  {approved.length === 0 ? (
                    <Empty title="עדיין אין הוצאות מאושרות" text="מסמך הוצאה שמאשרים מופיע כאן, לפי החודש שבו הוא נכתב." />
                  ) : (
                    months.map((m) => (
                      <section key={m.key} aria-labelledby={`month-${m.key}`} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <h2 id={`month-${m.key}`} className="font-display text-lg text-ink">
                            {m.label}
                          </h2>
                          <div className="text-sm text-ink-muted">
                            סה״כ <span className="font-semibold text-ink">{formatDocMoney(monthTotalAgorot(m.rows))}</span>
                          </div>
                        </div>
                        <Card>
                          <ul className="divide-y divide-cream-200">{m.rows.map(row)}</ul>
                        </Card>
                      </section>
                    ))
                  )}
                </div>
              ),
            },
            {
              key: "drafts",
              href: "/expenses?view=drafts",
              label: `טיוטות לאישור/הסרה (${shapedDrafts.length})`,
              panel: (
                <div className="mt-6">
                  {shapedDrafts.length === 0 ? (
                    <Empty title="אין טיוטות" text="מסמך שהועלה ועוד לא אושר מופיע כאן." />
                  ) : (
                    <Card>
                      <ul className="divide-y divide-cream-200">{shapedDrafts.map(row)}</ul>
                    </Card>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <FileOutput className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
        <h2 className="font-display text-xl text-ink">{title}</h2>
        <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">{text}</p>
      </CardContent>
    </Card>
  );
}
