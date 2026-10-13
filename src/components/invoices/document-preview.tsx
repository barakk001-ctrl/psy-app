import {
  CARD_TYPE_LABELS,
  DEAL_TYPE_LABELS,
  DOC_KINDS,
  PAYMENT_DETAIL_FIELDS,
  PAYMENT_DETAIL_LABELS,
  PAYMENT_KIND_LABELS,
  agorotToDecimalString,
  documentTotals,
  lineAgorot,
  type CardType,
  type DealType,
  type DocumentDraft,
} from "@/lib/billing-docs";

export type PreviewBusiness = {
  name: string;
  businessId: string | null;
  address: string | null;
  phone: string | null;
  vatLiable: boolean;
};

const ils = (agorot: number) =>
  `₪${Number(agorotToDecimalString(agorot)).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function heDate(day: string | null | undefined): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * The document as it will look — what the practitioner checks before issuing
 * (she always previews in morning). The official PDF is morning's; this is
 * the app's rendering of the same details, available with or without a
 * connection.
 */
export function DocumentPreview({
  draft,
  business,
  number,
  status,
}: {
  draft: DocumentDraft;
  business: PreviewBusiness;
  /** morning's number once issued */
  number?: string | null;
  /** "draft" shows the not-a-tax-document band */
  status: "draft" | "issued";
}) {
  const info = DOC_KINDS[draft.kind];
  const t = documentTotals(draft, business.vatLiable);

  return (
    <article className="relative rounded-2xl border border-cream-300 bg-white text-ink shadow-soft overflow-hidden">
      {status === "draft" && (
        <div className="bg-cream-100 border-b border-cream-300 px-5 py-2 text-xs text-ink-soft text-center">
          תצוגה מקדימה — עדיין לא מסמך מס. המסמך הרשמי מופק ב-morning.
        </div>
      )}
      <div className="p-5 sm:p-7 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display text-lg">{business.name}</div>
            <div className="text-xs text-ink-muted mt-1 space-y-0.5">
              {business.businessId && (
                <div>
                  {business.vatLiable ? "עוסק מורשה" : "עוסק פטור"} {business.businessId}
                </div>
              )}
              {business.address && <div>{business.address}</div>}
              {business.phone && <div dir="ltr" className="text-end">{business.phone}</div>}
            </div>
          </div>
          <div className="text-end">
            <div className="font-display text-2xl">
              {info.label}
              {number ? <> {number}</> : null}
            </div>
            <div className="text-xs text-ink-muted mt-1">תאריך: {heDate(draft.date)}</div>
            {info.hasDueDate && draft.dueDate && (
              <div className="text-xs text-ink-muted">לתשלום עד: {heDate(draft.dueDate)}</div>
            )}
          </div>
        </header>

        <section>
          <div className="text-xs text-ink-muted">לכבוד</div>
          <div className="font-medium">{draft.clientName || "—"}</div>
          {draft.clientTaxId && <div className="text-xs text-ink-muted">ת״ז / ח״פ: {draft.clientTaxId}</div>}
          {draft.description && <p className="text-sm text-ink-soft mt-2">{draft.description}</p>}
        </section>

        {info.hasItems && (
          <section>
            <h3 className="text-sm font-semibold mb-2">פירוט</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-300 text-xs text-ink-muted">
                  <th className="text-start py-1.5 font-medium">תיאור</th>
                  <th className="text-center py-1.5 font-medium w-14">כמות</th>
                  <th className="text-end py-1.5 font-medium w-24">מחיר</th>
                  <th className="text-end py-1.5 font-medium w-24">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((it, i) => (
                  <tr key={i} className="border-b border-cream-200">
                    <td className="py-2 pe-2">{it.description || "—"}</td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-end">{ils(it.unitPriceAgorot)}</td>
                    <td className="py-2 text-end">{ils(lineAgorot(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 ms-auto max-w-xs space-y-1 text-sm">
              {business.vatLiable && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">סכום לפני מע״מ</span>
                    <span>{ils(t.netAgorot)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">מע״מ {t.vatPercent}%</span>
                    <span>{ils(t.vatAgorot)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold border-t border-cream-300 pt-1">
                <span>סה״כ</span>
                <span>{ils(t.totalAgorot)}</span>
              </div>
            </div>
          </section>
        )}

        {info.hasPayments && (
          <section>
            <h3 className="text-sm font-semibold mb-2">פירוט תקבולים</h3>
            <ul className="divide-y divide-cream-200 border-y border-cream-200 text-sm">
              {draft.payments.map((p, i) => {
                const details = PAYMENT_DETAIL_FIELDS[p.method]
                  .map((f) => {
                    const v = p[f];
                    if (v == null || v === "") return null;
                    const shown =
                      f === "cardType"
                        ? CARD_TYPE_LABELS[v as CardType]
                        : f === "dealType"
                          ? DEAL_TYPE_LABELS[v as DealType]
                          : String(v);
                    return `${PAYMENT_DETAIL_LABELS[f]}: ${shown}`;
                  })
                  .filter(Boolean);
                return (
                  <li key={i} className="py-2 flex flex-wrap justify-between gap-x-4">
                    <span>
                      {PAYMENT_KIND_LABELS[p.method]} · {heDate(p.date)}
                      {details.length > 0 && (
                        <span className="block text-xs text-ink-muted">{details.join(" · ")}</span>
                      )}
                    </span>
                    <span className="font-medium">{ils(p.amountAgorot)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex justify-between text-sm font-semibold max-w-xs ms-auto">
              <span>סה״כ שולם</span>
              <span>{ils(t.paymentsAgorot)}</span>
            </div>
          </section>
        )}

        {draft.remarks && (
          <section>
            <h3 className="text-sm font-semibold mb-1">הערות</h3>
            <p className="text-sm text-ink-soft whitespace-pre-wrap">{draft.remarks}</p>
          </section>
        )}
      </div>
    </article>
  );
}
