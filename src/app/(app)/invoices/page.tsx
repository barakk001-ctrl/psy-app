import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">חשבוניות</h1>
          <p className="text-ink-muted mt-1 text-sm">
            {invoices.length === 0
              ? "אין חשבוניות עדיין"
              : `${invoices.length} חשבוניות`}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="w-4 h-4" /> חשבונית חדשה
          </Button>
        </Link>
      </header>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
            <h3 className="font-display text-xl text-ink">עדיין אין חשבוניות</h3>
            <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">
              צור חשבונית מפגישות שכבר התקיימו, או הוסף שורות חיוב מותאמות.
            </p>
            <Link href="/invoices/new" className="inline-block mt-5">
              <Button>
                <Plus className="w-4 h-4" /> חשבונית ראשונה
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
                    <div className="font-display text-base sm:text-lg text-ink shrink-0 w-14 sm:w-20">
                      #{String(inv.number).padStart(4, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate text-sm sm:text-base">
                        {inv.client.firstName} {inv.client.lastName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-ink-muted">
                          {formatDate(inv.issueDate)}
                        </span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-medium text-ink text-sm sm:text-base">
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
