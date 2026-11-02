import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { morningNewDocumentUrl } from "@/lib/billing-docs";

export type CreditableInvoice = {
  id: string;
  /** "חשבונית מס 20345" */
  label: string;
  clientName: string;
  /** "12.10.26" */
  date: string;
  amount: string;
};

/**
 * The "חשבונית זיכוי" square. A credit note cancels one issued invoice, so
 * this leads to that invoice's page, where "ביטול בחשבונית זיכוי" issues it.
 * Nothing is issued from here.
 */
export function CreditNotePicker({
  invoices,
  morningConnected,
}: {
  invoices: CreditableInvoice[];
  morningConnected: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>איזו חשבונית מבטלים?</CardTitle>
      </CardHeader>
      {invoices.length > 0 ? (
        <>
          <p className="px-5 pt-4 text-sm text-ink-muted">
            חשבונית זיכוי מבטלת את כל החשבונית. בוחרים אותה, ובעמוד שלה לוחצים ״ביטול בחשבונית
            זיכוי״.
          </p>
          <ul className="divide-y divide-cream-200 mt-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-cream-100/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm truncate">{inv.clientName}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {inv.label} · {inv.date}
                    </div>
                  </div>
                  <div className="font-medium text-ink text-sm shrink-0">{inv.amount}</div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : morningConnected ? (
        <CardContent>
          <p className="text-sm text-ink-muted">
            אין כרגע חשבונית מס שהופקה ב-morning ואפשר לבטל אותה.
          </p>
        </CardContent>
      ) : (
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-muted">
            morning לא מחובר, אז חשבונית זיכוי מפיקים שם ישירות. כדי לבטל חשבונית מכאן, מחברים את
            morning ב
            <Link href="/settings" className="text-sage-600 hover:text-sage-700 hover:underline">
              הגדרות
            </Link>
            .
          </p>
          <a
            href={morningNewDocumentUrl("CREDIT_NOTE")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> פתיחה ב-morning
          </a>
        </CardContent>
      )}
    </Card>
  );
}
