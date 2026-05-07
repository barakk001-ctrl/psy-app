import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Send,
  XCircle,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { PaymentForm } from "@/components/invoices/payment-form";
import {
  markInvoiceSentAction,
  cancelInvoiceAction,
} from "@/server/actions/invoices";
import { deletePaymentAction } from "@/server/actions/payments";
import { formatCurrency, formatDate } from "@/lib/format";

const METHOD_LABELS = {
  CASH: "מזומן",
  BIT: "ביט",
  CHECK: "המחאה",
  BANK_TRANSFER: "העברה בנקאית",
  CREDIT_CARD: "כרטיס אשראי",
  PAYPAL: "PayPal",
  OTHER: "אחר",
} as const;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const invoice = await db.invoice.findFirst({
    where: { id, userId },
    include: {
      client: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const total = Number(invoice.total);
  const paid = Number(invoice.amountPaid);
  const balance = total - paid;

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לרשימת החשבוניות
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <h1 className="font-display text-3xl text-ink">
            חשבונית #{String(invoice.number).padStart(4, "0")}
          </h1>
          <div className="text-ink-muted mt-1 text-sm">
            הופקה ב-{formatDate(invoice.issueDate)}
            {invoice.dueDate && <> · לתשלום עד {formatDate(invoice.dueDate)}</>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              הורדת PDF
            </Button>
          </a>
          {invoice.status === "DRAFT" && (
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm">
                <Send className="w-4 h-4" />
                סימון כנשלחה
              </Button>
            </form>
          )}
          {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
            <form action={cancelInvoiceAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm" variant="ghost">
                <XCircle className="w-4 h-4" />
                ביטול
              </Button>
            </form>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>פירוט</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-300">
                  <th className="text-start text-xs uppercase tracking-wider text-ink-muted px-5 py-3 font-medium">
                    תיאור
                  </th>
                  <th className="text-center text-xs uppercase tracking-wider text-ink-muted px-3 py-3 font-medium w-16">
                    כמות
                  </th>
                  <th className="text-end text-xs uppercase tracking-wider text-ink-muted px-3 py-3 font-medium w-28">
                    מחיר
                  </th>
                  <th className="text-end text-xs uppercase tracking-wider text-ink-muted px-5 py-3 font-medium w-28">
                    סה״כ
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it) => (
                  <tr key={it.id} className="border-b border-cream-200">
                    <td className="px-5 py-3 text-sm text-ink-soft">{it.description}</td>
                    <td className="px-3 py-3 text-sm text-ink-soft text-center">
                      {Number(it.quantity)}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-soft text-end">
                      {formatCurrency(it.unitPrice.toString())}
                    </td>
                    <td className="px-5 py-3 text-sm text-ink text-end font-medium">
                      {formatCurrency(it.amount.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-5 py-4 space-y-2 border-t border-cream-300">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">סכום ביניים</span>
                <span className="text-ink">{formatCurrency(invoice.subtotal.toString())}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-cream-200">
                <span className="font-display text-lg text-ink">סה״כ</span>
                <span className="font-display text-lg text-ink">{formatCurrency(total)}</span>
              </div>
              {paid > 0 && (
                <>
                  <div className="flex justify-between text-sm pt-2 border-t border-cream-200">
                    <span className="text-ink-muted">שולם</span>
                    <span className="text-sage-600">−{formatCurrency(paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-ink">יתרה</span>
                    <span className={balance > 0 ? "text-terracotta-600" : "text-sage-600"}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>לקוח/ה</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Link
                href={`/clients/${invoice.client.id}`}
                className="flex items-center gap-2 text-ink hover:text-sage-600"
              >
                <UserIcon className="w-4 h-4 text-ink-subtle" />
                <span className="font-medium">
                  {invoice.client.firstName} {invoice.client.lastName}
                </span>
              </Link>
              {invoice.client.idNumber && (
                <div className="text-xs text-ink-muted">
                  ת.ז: <span dir="ltr">{invoice.client.idNumber}</span>
                </div>
              )}
              {invoice.client.email && (
                <div className="text-xs text-ink-muted" dir="ltr">{invoice.client.email}</div>
              )}
              {invoice.client.phone && (
                <div className="text-xs text-ink-muted" dir="ltr">{invoice.client.phone}</div>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>הערות</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payments */}
      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle>תשלומים</CardTitle>
            {balance > 0 && (
              <p className="text-xs text-ink-muted mt-1">
                יתרה לתשלום: {formatCurrency(balance)}
              </p>
            )}
          </div>
          {invoice.status !== "CANCELLED" && balance > 0 && (
            <PaymentForm invoiceId={invoice.id} defaultAmount={balance} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {invoice.payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted">
              עדיין לא נרשמו תשלומים
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm text-ink">
                      {formatCurrency(p.amount.toString())} · {METHOD_LABELS[p.method]}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {formatDate(p.paidAt)}
                      {p.reference && <> · {p.reference}</>}
                    </div>
                  </div>
                  <form action={deletePaymentAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-ink-muted hover:text-terracotta-500 p-1"
                      aria-label="מחק תשלום"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
