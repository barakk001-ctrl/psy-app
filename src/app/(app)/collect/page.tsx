import Link from "next/link";
import { Receipt, Wallet, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default async function CollectPage() {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const [invoices, unpaidSessions] = await Promise.all([
    db.invoice.findMany({
      where: { userId, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
      orderBy: [{ issueDate: "asc" }],
      take: 50,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
    // Meetings from the last 3 weeks with no payment marked yet (mirrors the
    // documentation page). Invoiced meetings are tracked on the invoice instead.
    db.session.findMany({
      where: {
        userId,
        status: { in: ["SCHEDULED", "COMPLETED"] },
        startsAt: {
          gte: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
          lte: now,
        },
        paymentStatus: null,
        invoiceItem: { is: null },
      },
      orderBy: { startsAt: "desc" },
      take: 40,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">אישורי תשלום</h1>
        <p className="text-ink-muted mt-1 text-sm">
          פגישות שעוד לא עודכן להן תשלום וחשבוניות עם יתרה פתוחה.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">
          פגישות ללא עדכון תשלום
        </h2>
        {unpaidSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-ink-muted">
              <CheckCircle2
                className="w-8 h-8 mx-auto text-sage-600 mb-2"
                strokeWidth={1.5}
              />
              לכל הפגישות משלושת השבועות האחרונים עודכן תשלום 🎉
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-cream-200">
              {unpaidSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}#billing`}
                    className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-cream-100/60 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-ink">
                        {s.client.firstName} {s.client.lastName}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {formatDateTime(s.startsAt)}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border shrink-0 bg-terracotta-500/10 border-terracotta-500/30 text-terracotta-600">
                      <Wallet className="w-3.5 h-3.5" /> לא עודכן תשלום
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">חשבוניות פתוחות</h2>
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-ink-muted space-y-3">
              <Receipt
                className="w-8 h-8 mx-auto text-ink-subtle"
                strokeWidth={1.5}
              />
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
                        <div className="text-[10px] text-ink-muted">
                          יתרה לתשלום
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
