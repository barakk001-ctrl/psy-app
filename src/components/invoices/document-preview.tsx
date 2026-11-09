import {
  CARD_TYPE_LABELS,
  DEAL_TYPE_LABELS,
  DOC_KINDS,
  PAYMENT_DETAIL_FIELDS,
  PAYMENT_KIND_LABELS,
  documentTotals,
  formatDocMoney,
  lineAgorot,
  paymentDetailLabel,
  type CardType,
  type DealType,
  type DocumentDraft,
} from "@/lib/billing-docs";
import { DEFAULT_DOC_LOOK, DOC_COLORS, tint, type DocLook } from "@/lib/document-look";
import type { DocBusiness } from "@/lib/document-business";

export type PreviewBusiness = DocBusiness;

/** "08/11/2026 14:05", clinic time: the moment the preview or PDF was produced. */
export function producedAtNow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

function heDate(day: string | null | undefined): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** What the band at the top says: the app doesn't issue official documents yet. */
export function previewNotice(status: "draft" | "issued"): string {
  return status === "draft"
    ? "טיוטה — עדיין לא מסמך מס"
    : "לעיון בלבד — המסמך הרשמי הוא זה שהופק במערכת ההפקה";
}

/** Payment details as one line ("בנק: לאומי · סניף: 800"). */
export function paymentDetailsLine(p: DocumentDraft["payments"][number]): string {
  return PAYMENT_DETAIL_FIELDS[p.method]
    .map((f) => {
      const v = p[f];
      if (v == null || v === "") return null;
      const shown =
        f === "cardType"
          ? CARD_TYPE_LABELS[v as CardType]
          : f === "dealType"
            ? DEAL_TYPE_LABELS[v as DealType]
            : String(v);
      return `${paymentDetailLabel(p.method, f)}: ${shown}`;
    })
    .filter(Boolean)
    .join(" · ");
}

/**
 * The document laid out like an Israeli tax document, in the practice's
 * template and color: business details and logo, "לכבוד", type and number
 * (or "טיוטה"), dates, lines, VAT and totals, receipts, notes, signature and
 * the "הופק ע״י" footer. Always marked as not the official document: the app
 * doesn't issue documents yet. The draft PDF (document-pdf.tsx) mirrors it.
 */
export function DocumentPreview({
  draft,
  business,
  number,
  status,
  producedAt,
  look: lookProp,
  compact = false,
}: {
  draft: DocumentDraft;
  business: PreviewBusiness;
  /** the document's number once issued */
  number?: string | null;
  status: "draft" | "issued";
  /** producedAtNow(), formatted where it is rendered */
  producedAt?: string;
  /** overrides the business's own (the settings card's live preview) */
  look?: DocLook;
  /** the settings card's smaller copy */
  compact?: boolean;
}) {
  const info = DOC_KINDS[draft.kind];
  const t = documentTotals(draft, business.vatLiable);
  const ils = (agorot: number) => formatDocMoney(agorot, draft.currency);
  const look = lookProp ?? business.look ?? DEFAULT_DOC_LOOK;
  const color = DOC_COLORS[look.color].hex;
  const light = tint(color);
  const band = look.template === "band";
  const minimal = look.template === "minimal";
  const showVat = business.vatLiable && draft.vatType !== 1;

  const contact = [business.phone, business.email, business.website].filter(Boolean) as string[];
  const idLine = business.businessId
    ? `${business.vatLiable ? "עוסק מורשה" : "עוסק פטור"} ${business.businessId}`
    : null;

  const thStyle = band
    ? { backgroundColor: color, color: "#FFFFFF" }
    : minimal
      ? { borderBottom: `2px solid ${color}` }
      : { backgroundColor: light };
  const th = "py-2 px-2 font-medium text-start";
  const totalStyle = band ? { backgroundColor: color, color: "#FFFFFF" } : { backgroundColor: light };

  const businessBlock = (
    <div className={`flex gap-3 ${minimal ? "flex-col items-center text-center" : "items-start"}`}>
      {business.logoUrl && (
        // A small data: URL from Settings → מיתוג; next/image adds nothing here
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.logoUrl}
          alt=""
          className={`${compact ? "w-10 h-10" : "w-14 h-14 sm:w-16 sm:h-16"} rounded-xl object-cover shrink-0 bg-white`}
        />
      )}
      <div className="min-w-0">
        <div
          className={`font-display ${compact ? "text-base" : "text-xl sm:text-2xl"} leading-tight`}
          style={band ? undefined : { color }}
        >
          {business.name || "שם העסק"}
        </div>
        {business.occupation && <div className="text-sm mt-0.5">{business.occupation}</div>}
        {business.description && (
          <div className={`text-xs mt-0.5 ${band ? "text-white/90" : "text-ink-soft"}`}>{business.description}</div>
        )}
        <div className={`text-xs mt-1.5 space-y-0.5 ${band ? "text-white/90" : "text-ink-muted"}`}>
          {idLine && <div>{idLine}</div>}
          {business.address && <div>{business.address}</div>}
          {contact.length > 0 && (
            <div className={`flex flex-wrap gap-x-2 ${minimal ? "justify-center" : ""}`}>
              {contact.map((c, i) => (
                <span key={c}>
                  <span dir="ltr">{c}</span>
                  {i < contact.length - 1 && <span aria-hidden> ·</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const docBlock = (
    <div className={minimal ? "text-center" : "text-end"}>
      <div
        className={`font-display ${compact ? "text-lg" : "text-2xl sm:text-3xl"} leading-tight`}
        style={band ? undefined : { color }}
      >
        {info.label}
      </div>
      <div className="mt-1 text-sm">
        {number ? (
          <>
            מס׳ <span dir="ltr" className="font-semibold">{number}</span>
          </>
        ) : (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              band ? "bg-white/20 text-white" : "bg-gold-200 text-ink"
            }`}
          >
            טיוטה
          </span>
        )}
      </div>
    </div>
  );

  const dates = (
    <div className={`text-sm space-y-0.5 ${minimal ? "text-center" : "text-end"}`}>
      <div>
        <span className="text-ink-muted">תאריך: </span>
        <span dir="ltr">{heDate(draft.date)}</span>
      </div>
      {info.hasDueDate && draft.dueDate && (
        <div>
          <span className="text-ink-muted">לתשלום עד: </span>
          <span dir="ltr">{heDate(draft.dueDate)}</span>
        </div>
      )}
    </div>
  );

  return (
    <article
      aria-label={`תצוגה מקדימה: ${info.label}`}
      className={`relative mx-auto w-full ${
        compact ? "text-[11px]" : "max-w-[820px] text-sm sm:text-[15px] sm:aspect-[210/297]"
      } rounded-2xl border border-cream-300 bg-white text-ink shadow-soft flex flex-col`}
    >
      {/* No overflow-hidden on the page: with an aspect ratio it would cut a long document off */}
      <div className="rounded-t-2xl bg-cream-100 border-b border-cream-300 px-4 py-1.5 text-xs text-ink-soft text-center">
        {previewNotice(status)}
      </div>
      {status === "draft" && !compact && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl flex items-center justify-center select-none">
          <span className="font-display text-[110px] sm:text-[160px] -rotate-[30deg] text-ink/[0.04]">טיוטה</span>
        </div>
      )}

      {band ? (
        <header
          className={`${compact ? "px-4 py-4" : "px-5 sm:px-10 py-6 sm:py-8"} text-white`}
          style={{ backgroundColor: color }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            {businessBlock}
            {docBlock}
          </div>
        </header>
      ) : minimal ? (
        <header className={`${compact ? "px-4 pt-4" : "px-5 sm:px-10 pt-6 sm:pt-10"} space-y-4`}>
          {businessBlock}
          <div className="border-t border-cream-300 pt-4">{docBlock}</div>
        </header>
      ) : (
        <header
          className={`${compact ? "mx-4 pt-4 pb-3" : "mx-5 sm:mx-10 pt-6 sm:pt-10 pb-5"} flex flex-wrap items-start justify-between gap-4`}
          style={{ borderBottom: `3px solid ${color}` }}
        >
          {businessBlock}
          <div className="space-y-2">
            {docBlock}
            {dates}
          </div>
        </header>
      )}

      <div className={`relative flex-1 flex flex-col ${compact ? "p-4 gap-3" : "p-5 sm:px-10 sm:py-8 gap-6"}`}>
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-ink-muted">לכבוד</div>
            <div className="font-semibold text-base">{draft.clientName || "—"}</div>
            {draft.clientTaxId && (
              <div className="text-xs text-ink-muted">
                ח.פ / ת.ז: <span dir="ltr">{draft.clientTaxId}</span>
              </div>
            )}
          </div>
          {(band || minimal) && dates}
        </section>
        {draft.description && <p className="text-ink-soft">{draft.description}</p>}

        {info.hasItems && (
          <section>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-xs" style={thStyle}>
                  <th className={th}>פירוט</th>
                  <th className={`${th} text-center w-12 sm:w-16`}>כמות</th>
                  <th className={`${th} text-end w-20 sm:w-28`}>מחיר ליחידה</th>
                  <th className={`${th} text-end w-20 sm:w-28`}>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((it, i) => (
                  <tr key={i} className="border-b border-cream-200 align-top">
                    <td className="py-2 px-2">{it.description || "—"}</td>
                    <td className="py-2 px-2 text-center">{it.quantity}</td>
                    <td className="py-2 px-2 text-end whitespace-nowrap">{ils(it.unitPriceAgorot)}</td>
                    <td className="py-2 px-2 text-end whitespace-nowrap">{ils(lineAgorot(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 ms-auto w-full max-w-xs space-y-1">
              {showVat && (
                <>
                  <div className="flex justify-between px-2">
                    <span className="text-ink-muted">סכום לפני מע״מ</span>
                    <span>{ils(t.netAgorot)}</span>
                  </div>
                  <div className="flex justify-between px-2">
                    <span className="text-ink-muted">מע״מ {t.vatPercent}%</span>
                    <span>{ils(t.vatAgorot)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold rounded-lg px-2 py-1.5" style={totalStyle}>
                <span>{info.hasPayments ? "סה״כ" : "סה״כ לתשלום"}</span>
                <span>{ils(t.totalAgorot)}</span>
              </div>
            </div>
          </section>
        )}

        {info.hasPayments && (
          <section>
            <h3 className="font-semibold mb-2" style={{ color }}>
              פירוט תקבולים
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-xs" style={thStyle}>
                  <th className={th}>סוג התקבול</th>
                  <th className={`${th} hidden sm:table-cell`}>פרטים</th>
                  <th className={`${th} w-24`}>תאריך</th>
                  <th className={`${th} text-end w-24 sm:w-28`}>סכום</th>
                </tr>
              </thead>
              <tbody>
                {draft.payments.map((p, i) => {
                  const details = paymentDetailsLine(p);
                  return (
                    <tr key={i} className="border-b border-cream-200 align-top">
                      <td className="py-2 px-2">
                        {PAYMENT_KIND_LABELS[p.method]}
                        {details && <span className="block sm:hidden text-xs text-ink-muted">{details}</span>}
                      </td>
                      <td className="py-2 px-2 hidden sm:table-cell text-xs text-ink-muted">{details || "—"}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span dir="ltr">{heDate(p.date)}</span>
                      </td>
                      <td className="py-2 px-2 text-end whitespace-nowrap">{ils(p.amountAgorot)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div
              className="mt-3 ms-auto w-full max-w-xs flex justify-between font-semibold rounded-lg px-2 py-1.5"
              style={totalStyle}
            >
              <span>סה״כ שולם</span>
              <span>{ils(t.paymentsAgorot)}</span>
            </div>
          </section>
        )}

        {draft.remarks && (
          <section>
            <h3 className="font-semibold mb-1" style={{ color }}>
              הערות
            </h3>
            <p className="text-ink-soft whitespace-pre-wrap">{draft.remarks}</p>
          </section>
        )}

        <div className="mt-auto pt-2 space-y-4">
          {business.signatureUrl && (
            <div className="flex justify-end">
              <div className="text-center">
                {/* A small data: URL from Settings → הגדרות מסמכים */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={business.signatureUrl}
                  alt="חתימה"
                  className={`${compact ? "max-h-10" : "max-h-16 sm:max-h-20"} max-w-[200px] object-contain mx-auto`}
                />
                <div className="border-t border-ink/30 mt-1 pt-0.5 px-6 text-xs text-ink-muted">חתימה</div>
              </div>
            </div>
          )}
          <footer className="text-xs text-ink-muted text-center border-t border-cream-200 pt-3">
            הופק ע״י מרפאה אישית · <span dir="ltr">mirpaa.app</span>
            {producedAt && (
              <>
                {" · "}
                <span dir="ltr">{producedAt}</span>
              </>
            )}
          </footer>
        </div>
      </div>
    </article>
  );
}
