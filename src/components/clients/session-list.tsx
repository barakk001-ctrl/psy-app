import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SessionFlags } from "@/components/sessions/session-flags";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClientSessionRow = {
  id: string;
  startsAt: Date;
  status: string;
  rate: { toString(): string } | null;
  paymentStatus: string | null;
  morningDocNumber: string | null;
  morningInvoiceReceiptNumber: string | null;
  note: { id: string } | null;
  invoiceItem: {
    invoice: { number: number; morningDocNumber: string | null } | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "התקיימה",
  SCHEDULED: "מתוכננת",
  CANCELLED: "בוטלה",
  NO_SHOW: "לא התקיימה",
};

/** One collapsible group of a client's meetings (upcoming / held / cancelled),
 *  with its count in the heading. */
export function SessionList({
  title,
  sessions,
  emptyText,
  defaultOpen = false,
  showFlags = false,
  muted = false,
}: {
  title: string;
  sessions: ClientSessionRow[];
  emptyText: string;
  defaultOpen?: boolean;
  showFlags?: boolean;
  muted?: boolean;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <Card className="hover:border-sage-300 transition-colors">
          <CardContent className="py-4 flex items-center justify-between">
            <span className={cn("font-display text-lg", muted ? "text-ink-muted" : "text-ink")}>
              {title} ({sessions.length})
            </span>
            <span className="text-xs text-ink-muted group-open:hidden">הצגה ←</span>
            <span className="text-xs text-ink-muted hidden group-open:inline">הסתרה ↑</span>
          </CardContent>
        </Card>
      </summary>
      <Card className="mt-3">
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted">{emptyText}</div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="px-5 py-3 flex items-center justify-between hover:bg-cream-100/60 transition-colors"
                  >
                    <div>
                      <div className={cn("text-sm flex items-center gap-2", muted ? "text-ink-muted" : "text-ink")}>
                        {formatDateTime(s.startsAt)}
                        {showFlags && (
                          <SessionFlags
                            documented={!!s.note}
                            paymentDone={!!s.paymentStatus || !!s.invoiceItem}
                          />
                        )}
                        {(s.status === "CANCELLED" || s.status === "NO_SHOW") && (
                          <span className="rounded-full bg-cream-200 text-ink-muted text-[10px] px-2 py-0.5">
                            {STATUS_LABEL[s.status]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {s.status === "COMPLETED" || s.status === "SCHEDULED"
                          ? showFlags
                            ? "התקיימה"
                            : "מתוכננת"
                          : null}
                        {s.invoiceItem?.invoice && (
                          <>
                            {" · "}חשבונית #{String(s.invoiceItem.invoice.number).padStart(4, "0")}
                            {s.invoiceItem.invoice.morningDocNumber && (
                              <>
                                {" · "}קבלה{" "}
                                <span dir="ltr">{s.invoiceItem.invoice.morningDocNumber}</span>
                              </>
                            )}
                          </>
                        )}
                        {!s.invoiceItem?.invoice && s.morningDocNumber && (
                          <>
                            {" · "}חשבונית morning <span dir="ltr">{s.morningDocNumber}</span>
                          </>
                        )}
                        {!s.invoiceItem?.invoice && s.morningInvoiceReceiptNumber && (
                          <>
                            {" · "}חשבונית מס-קבלה{" "}
                            <span dir="ltr">{s.morningInvoiceReceiptNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {s.rate && (
                      <span className="text-xs text-ink-muted">
                        {formatCurrency(s.rate.toString())}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </details>
  );
}
