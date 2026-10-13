import Link from "next/link";
import { ChevronLeft, ExternalLink, User as UserIcon, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import {
  DOC_KINDS,
  canCreditNote,
  docKindByCode,
  docTypeLabel,
  morningCopyText,
  morningNewDocumentUrl,
} from "@/lib/billing-docs";
import { draftFromInvoice, type InvoiceWithParts } from "@/lib/billing-doc-data";
import { cancelInvoiceAction } from "@/server/actions/invoices";
import { formatDate } from "@/lib/format";
import { DocumentPreview, type PreviewBusiness } from "./document-preview";
import { DraftDocumentActions, IssuedDocumentActions } from "./document-actions";

/** A document made in "מסמך חדש" (Invoice with docType): draft or issued in morning. */
export async function DocumentView({
  invoice,
  business,
  morningConnected,
  notice,
}: {
  invoice: InvoiceWithParts;
  business: PreviewBusiness;
  morningConnected: boolean;
  notice: { issued?: boolean; saved?: boolean; issueError?: string; uncertain?: boolean };
}) {
  const info = docKindByCode(invoice.docType)!;
  const draft = draftFromInvoice(invoice)!;
  const issued = !!invoice.morningDocNumber;
  const cancelled = invoice.status === "CANCELLED";

  const [related, linkedToThis] = await Promise.all([
    invoice.relatedInvoiceId
      ? db.invoice.findFirst({
          where: { id: invoice.relatedInvoiceId, userId: invoice.userId },
          select: { id: true, docType: true, morningDocNumber: true, number: true },
        })
      : null,
    db.invoice.findMany({
      where: { userId: invoice.userId, relatedInvoiceId: invoice.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, docType: true, morningDocNumber: true, number: true, status: true },
    }),
  ]);
  const docName = (d: { docType: number | null; morningDocNumber: string | null; number: number }) =>
    `${docTypeLabel(d.docType)} ${d.morningDocNumber ?? `(טיוטה #${d.number})`}`;

  const hasCreditNote = linkedToThis.some(
    (d) => d.docType === DOC_KINDS.CREDIT_NOTE.code && d.status !== "CANCELLED",
  );
  const canReceipt =
    issued && invoice.docType === DOC_KINDS.TAX_INVOICE.code && !cancelled && invoice.status !== "PAID";
  const canCredit = morningConnected && canCreditNote(invoice) && !hasCreditNote;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לחשבוניות וקבלות
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cancelled
                ? "bg-cream-200 text-ink-muted"
                : issued
                  ? "bg-sage-100 text-sage-700"
                  : "bg-gold-200 text-ink"
            }`}
          >
            {cancelled ? "בוטל" : issued ? "הופק ב-morning" : "טיוטה"}
          </span>
          <h1 className="font-display text-3xl text-ink mt-2">
            {info.label} {issued ? invoice.morningDocNumber : ""}
          </h1>
          <div className="text-sm text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/clients/${invoice.client.id}`} className="inline-flex items-center gap-1 hover:text-sage-600">
              <UserIcon className="w-4 h-4" />
              {invoice.client.firstName} {invoice.client.lastName}
            </Link>
            <span>{formatDate(invoice.issueDate)}</span>
            {related && (
              <Link href={`/invoices/${related.id}`} className="text-sage-600 hover:underline">
                {invoice.docType === DOC_KINDS.CREDIT_NOTE.code ? "מבטלת את " : "עבור "}
                {docName(related)}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {issued && invoice.morningDocUrl && (
            <a href={invoice.morningDocUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="secondary">
                <ExternalLink className="w-4 h-4" /> המסמך ב-morning
              </Button>
            </a>
          )}
          {!issued && !cancelled && (
            <>
              <PdfButton
                url={`/api/invoices/${invoice.id}/pdf`}
                fileName={`draft-${invoice.number}.pdf`}
                label="PDF של הטיוטה"
              />
              <form action={cancelInvoiceAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <Button type="submit" size="sm" variant="ghost">
                  <XCircle className="w-4 h-4" /> ביטול הטיוטה
                </Button>
              </form>
            </>
          )}
        </div>
      </header>

      {notice.issued && issued && (
        <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
          ה{info.label} הופקה ב-morning ✓ — מספר {invoice.morningDocNumber}.
          {invoice.docClientEmail ? ` morning שולח אותה ל-${invoice.docClientEmail}.` : ""}
        </div>
      )}
      {notice.saved && !issued && (
        <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
          הטיוטה נשמרה.
        </div>
      )}

      {!issued && !cancelled && (
        <DraftDocumentActions
          invoiceId={invoice.id}
          label={info.label}
          morningConnected={morningConnected}
          morningUrl={morningNewDocumentUrl(info.kind)}
          copyText={morningCopyText(draft, business.vatLiable)}
          initialError={notice.issueError || null}
          uncertain={notice.uncertain}
        />
      )}

      {issued && !cancelled && (
        <IssuedDocumentActions
          invoiceId={invoice.id}
          canReceipt={canReceipt}
          canCredit={canCredit}
          label={info.label}
        />
      )}
      {issued && !cancelled && invoice.docType === DOC_KINDS.RECEIPT.code && (
        <p className="text-xs text-ink-muted">
          צריך לבטל קבלה? מבטלים אותה ב-morning (״ביטול מסמך״) — קבלה רשמית לא נמחקת.
        </p>
      )}

      {linkedToThis.length > 0 && (
        <div className="rounded-xl border border-cream-300 bg-white/60 px-4 py-3 text-sm">
          <div className="text-ink-muted text-xs mb-1">מסמכים קשורים</div>
          <ul className="space-y-0.5">
            {linkedToThis.map((d) => (
              <li key={d.id}>
                <Link href={`/invoices/${d.id}`} className="text-sage-600 hover:underline">
                  {docName(d)}
                </Link>
                {d.status === "CANCELLED" && <span className="text-ink-muted"> · בוטל</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DocumentPreview
        draft={draft}
        business={business}
        number={invoice.morningDocNumber}
        status={issued ? "issued" : "draft"}
      />
    </div>
  );
}
