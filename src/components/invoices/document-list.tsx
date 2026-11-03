import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import type { DocMonths, DocRow } from "@/lib/income-doc-rows";
import { MAX_DOC_ROWS } from "@/lib/income-doc-limits";

function Row({ inv, drafts }: { inv: DocRow; drafts: boolean }) {
  return (
    <li>
      <Link
        href={`/invoices/${inv.id}`}
        className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 hover:bg-cream-100/60 transition-colors"
      >
        <div className="shrink-0 w-20 sm:w-28">
          {inv.typeLabel ? (
            <>
              <div className="text-[11px] sm:text-xs text-ink-muted leading-tight">{inv.typeLabel}</div>
              <div className="font-display text-base sm:text-lg text-ink">
                {inv.docNumber ?? <span className="text-sm text-ink-muted font-sans font-medium">טיוטה</span>}
              </div>
            </>
          ) : (
            <div className="font-display text-base sm:text-lg text-ink">{inv.oldNumber}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate text-sm sm:text-base">{inv.clientName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] sm:text-xs text-ink-muted">{inv.date}</span>
            {!drafts && !inv.credit && <InvoiceStatusBadge status={inv.status} />}
          </div>
        </div>
        <div className="text-end shrink-0">
          <div className="font-medium text-ink text-sm sm:text-base">{inv.amount}</div>
          {inv.balance && (
            <div className="text-[10px] sm:text-xs text-terracotta-600 mt-0.5">יתרה: {inv.balance}</div>
          )}
        </div>
      </Link>
    </li>
  );
}

/** One tab's documents, under their months. */
export function DocumentList({
  data,
  drafts,
  anyDocuments,
}: {
  data: DocMonths;
  drafts: boolean;
  anyDocuments: boolean;
}) {
  const tab = drafts ? "drafts" : "documents";
  if (data.months.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
          <h2 className="font-display text-xl text-ink">
            {drafts ? "אין טיוטות" : anyDocuments ? "אין מסמכים לפי הסינון הזה" : "עדיין אין מסמכים"}
          </h2>
          <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">
            {drafts
              ? "מסמך שנשמר ב״שמירה כטיוטה״ מופיע כאן עד שמפיקים אותו."
              : anyDocuments
                ? "אפשר לשנות את התקופה, הסוג או הסטטוס."
                : "חשבונית או קבלה על פגישות שהתקיימו — בוחרים למעלה את סוג המסמך, מסמנים את הפגישות, בודקים בתצוגה המקדימה ומפיקים."}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      {data.months.map((m) => (
        <section key={m.key} aria-labelledby={`${tab}-${m.key}`} className="space-y-2">
          <h2 id={`${tab}-${m.key}`} className="font-display text-lg text-ink">
            {m.label}
          </h2>
          <Card>
            <ul className="divide-y divide-cream-200">
              {m.rows.map((inv) => (
                <Row key={inv.id} inv={inv} drafts={drafts} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {data.capped && (
        <p className="text-xs text-ink-muted text-center">מוצגים {MAX_DOC_ROWS} המסמכים האחרונים. אפשר לצמצם בסינון.</p>
      )}
    </>
  );
}
