import Link from "next/link";
import { Receipt } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function CollectPage() {
  const session = await auth();
  const userId = session!.user.id;

  const invoices = await db.invoice.findMany({
    where: { userId, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
    orderBy: [{ issueDate: "asc" }],
    take: 50,
    include: { client: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">אישור תשלום</h1>
        <p className="text-ink-muted mt-1 text-sm">
          חשבוניות עם יתרה פתוחה — בחרו חשבונית כדי לרשום תשלום שהתקבל ולהפיק
          קבלה.
        </p>
      </header>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-ink-muted space-y-3">
            <Receipt className="w-10 h-10 mx-auto text-ink-subtle" strokeWidth={1.5} />
            <p>אין חשבוניות פתוחות — הכול שולם 🎉</p>
            <Link
              href="/invoices/new"
              className="inline-block text-sage-600 hover:text-sage-700"
            >
              יצירת חשבונית חדשה ←
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-cream-200">
            {invoices.map((inv) => {
              const balance = Number(inv.total) - Number(inv.amountPaid);
              return (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-cream-100/60 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-ink">
                        {inv.client.firstName} {inv.client.lastName}
                        <span className="text-ink-muted font-normal">
                          {" "}
                          · #{String(inv.number).padStart(4, "0")}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                        {formatDate(inv.issueDate)}
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-display text-lg text-ink">
                        {formatCurrency(balance)}
                      </div>
                      <div className="text-[10px] text-ink-muted">יתרה לתשלום</div>
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
