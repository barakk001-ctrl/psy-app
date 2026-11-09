import { requireDocumentsPage } from "@/lib/features-server";
import { clientIdNumber } from "@/lib/sensitive-fields";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { DOC_BUSINESS_SELECT, docBusiness } from "@/lib/document-business";
import { db } from "@/lib/db";
import { creatableKinds, defaultKind, documentClientName, documentDefaults, docTypeLabel, DOC_KINDS, NOT_ISSUED, UNLINKED_SESSION, type DocKind } from "@/lib/billing-docs";
import { clinicDay, draftFromInvoice, loadCreditableInvoices } from "@/lib/billing-doc-data";
import { DocumentForm } from "@/components/invoices/document-form";

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);

/**
 * "מסמך חדש": type → client and dates → income lines (meetings) → receipt
 * lines → notes → preview → save a draft. The app doesn't issue documents yet:
 * the official one is issued elsewhere and its number recorded on the draft.
 */
export const metadata = { title: "מסמך חדש — מרפאה אישית" };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; sessionId?: string; kind?: string; forInvoice?: string; draft?: string }>;
}) {
  // Hidden until documents can be issued (src/lib/features.ts)
  requireDocumentsPage();
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  // A saved draft opened for editing: only one nothing was issued for
  const storedRow = params.draft
    ? await db.invoice.findFirst({
        where: {
          id: params.draft,
          userId,
          docType: { not: null },
          ...NOT_ISSUED,
          status: { not: "CANCELLED" },
          OR: [{ relatedInvoiceId: null }, { docType: DOC_KINDS.CREDIT_NOTE.code }],
        },
        include: { items: true, payments: true, client: true },
      })
    : null;
  const stored = storedRow ? draftFromInvoice(storedRow) : null;

  const [owner, clients, sessions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        ...DOC_BUSINESS_SELECT,
        defaultDocType: true,
        docCurrency: true,
        docLang: true,
        docVatType: true,
        docRounding: true,
      },
    }),
    db.client.findMany({
      // Inactive clients too (listed after the active ones)
      where: { userId },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, idNumber: true, idNumberCiphertext: true, email: true, defaultRate: true },
    }),
    // Meetings that took place (or were missed) and aren't billed yet
    db.session.findMany({
      where: {
        userId,
        // No payment link yet. A draft from before keeps the meetings tied to its lines.
        AND: [{ OR: [UNLINKED_SESSION, ...(storedRow ? [{ invoiceItem: { invoiceId: storedRow.id } }] : [])] }],
        OR: [
          { status: { in: ["COMPLETED", "NO_SHOW"] } },
          { status: "SCHEDULED", startsAt: { lt: now } },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 400,
      select: { id: true, clientId: true, startsAt: true, rate: true, treatmentType: true, status: true },
    }),
  ]);
  const vatLiable = !!owner?.vatLiable;

  // A receipt for a tax invoice (from that invoice's page)
  const forInvoice = params.forInvoice
    ? await db.invoice.findFirst({
        where: { id: params.forInvoice, userId, docType: DOC_KINDS.TAX_INVOICE.code, status: { not: "CANCELLED" } },
        select: { id: true, clientId: true, total: true, amountPaid: true, morningDocNumber: true, number: true, docClientName: true, docClientTaxId: true, currency: true },
      })
    : null;

  // The meeting she came from (session page "הפקת מסמך")
  const fromSession = params.sessionId ? sessions.find((s) => s.id === params.sessionId) : undefined;
  const clientId = forInvoice?.clientId ?? fromSession?.clientId ?? params.clientId;

  const kinds = creatableKinds(vatLiable).map((k) => k.kind);
  const requested = kinds.find((k) => k === params.kind) as DocKind | undefined;
  const initialKind = stored?.kind ?? requested ?? defaultKind(vatLiable, owner?.defaultDocType);
  const creditable = vatLiable ? await loadCreditableInvoices(userId, storedRow?.id) : [];

  const balance = forInvoice
    ? (Number(forInvoice.total.toString()) - Number(forInvoice.amountPaid.toString())).toFixed(2)
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href={forInvoice ? `/invoices/${forInvoice.id}` : "/invoices"}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        {forInvoice ? "חזרה לחשבונית" : "חזרה למסמכי הכנסות"}
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">
          {forInvoice ? "קבלה על חשבונית" : storedRow ? "עריכת טיוטה" : "מסמך חדש"}
        </h1>
        <p className="text-ink-muted text-sm mt-1">
          ממלאים, בודקים בתצוגה המקדימה ומפיקים או שומרים כטיוטה.
        </p>
      </header>
      <DocumentForm
        initialKind={initialKind}
        defaults={documentDefaults(owner ?? {})}
        creditableInvoices={creditable.map((inv) => ({
          id: inv.id,
          label: `${docTypeLabel(inv.docType)} ${inv.morningDocNumber ?? ""} · ${documentClientName(inv)}`,
          clientId: inv.clientId,
          clientName: documentClientName(inv),
          clientTaxId: inv.docClientTaxId,
          currency: inv.currency,
          vatIncluded: inv.vatIncluded,
          items: inv.items.map((it) => ({
            description: it.description,
            quantity: it.quantity.toString(),
            unitPrice: it.unitPrice.toString(),
          })),
        }))}
        today={clinicDay(now)}
        business={docBusiness(owner)}
        clients={clients.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          idNumber: clientIdNumber(c),
          email: c.email,
          rate: c.defaultRate ? c.defaultRate.toString() : null,
        }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          clientId: s.clientId,
          day: dayLabel(s.startsAt),
          label: `${dayLabel(s.startsAt)} · ${s.treatmentType}${s.status === "NO_SHOW" ? " · לא התקיימה" : ""}`,
          rate: s.rate ? s.rate.toString() : null,
        }))}
        initial={{
          clientId: clientId ?? undefined,
          sessionIds: fromSession ? [fromSession.id] : undefined,
          oneOffName: forInvoice && !forInvoice.clientId ? (forInvoice.docClientName ?? undefined) : undefined,
          oneOffTaxId: forInvoice && !forInvoice.clientId ? (forInvoice.docClientTaxId ?? undefined) : undefined,
          currency: forInvoice?.currency,
          stored:
            storedRow && stored
              ? {
                  id: storedRow.id,
                  clientId: storedRow.clientId,
                  relatedInvoiceId: storedRow.relatedInvoiceId,
                  draft: {
                    ...stored,
                    // Links from before they were kept apart from the lines
                    sessionIds: [
                      ...(stored.sessionIds ?? []),
                      ...stored.items.map((it) => it.sessionId).filter((id): id is string => !!id),
                    ],
                    items: stored.items.map((it) => ({ ...it, sessionId: null })),
                  },
                }
              : undefined,
          relatedInvoice:
            forInvoice && balance
              ? {
                  id: forInvoice.id,
                  label: `חשבונית מס ${forInvoice.morningDocNumber ?? `#${forInvoice.number}`}`,
                  balance,
                }
              : undefined,
        }}
      />
    </div>
  );
}
