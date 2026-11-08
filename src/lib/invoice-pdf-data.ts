import { db } from "@/lib/db";
import { clientIdNumber } from "@/lib/sensitive-fields";
import type { InvoicePDFData } from "@/components/invoices/invoice-pdf";
import { documentClientName, docTypeLabel, hasDocumentNumber } from "@/lib/billing-docs";
import { documentLogo, pdfLogo } from "@/lib/branding";
import { draftFromInvoice } from "@/lib/billing-doc-data";
import { DOC_BUSINESS_SELECT, docBusiness } from "@/lib/document-business";
import type { DocumentPdfData } from "@/components/invoices/document-pdf";
import { producedAtNow } from "@/components/invoices/document-preview";

export type LoadedInvoice = NonNullable<Awaited<ReturnType<typeof loadInvoiceWithRelations>>>;

function loadInvoiceWithRelations(invoiceId: string, userId: string) {
  return db.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      client: true,
      user: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
}

export async function loadInvoicePdfData(
  invoiceId: string,
  userId: string,
): Promise<{ invoice: LoadedInvoice; data: InvoicePDFData } | null> {
  const invoice = await loadInvoiceWithRelations(invoiceId, userId);
  if (!invoice) return null;

  const data: InvoicePDFData = {
    draftLabel: invoice.docType != null ? docTypeLabel(invoice.docType) : null,
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    notes: invoice.notes,
    business: {
      name: invoice.user.businessName ?? invoice.user.name,
      businessId: invoice.user.businessId,
      address: invoice.user.address,
      phone: invoice.user.phone,
      email: invoice.user.email,
      vatLiable: invoice.user.vatLiable,
      logo: pdfLogo(documentLogo(invoice.user)),
    },
    currency: invoice.currency,
    // A one-off client is known only by the name printed on the document
    client: invoice.client
      ? {
          firstName: invoice.client.firstName,
          lastName: invoice.client.lastName,
          idNumber: clientIdNumber(invoice.client),
          address: invoice.client.address,
          email: invoice.client.email,
          phone: invoice.client.phone,
        }
      : {
          firstName: documentClientName(invoice),
          lastName: "",
          idNumber: invoice.docClientTaxId,
          address: null,
          email: null,
          phone: null,
        },
    items: invoice.items.filter((it) => !it.linkOnly).map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      amount: Number(it.amount),
    })),
    payments: invoice.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt,
      reference: p.reference,
    })),
  };

  return { invoice, data };
}

/**
 * A "מסמך חדש" document (docType set) for its own PDF, laid out like the
 * preview: null for older app invoices and for anything not the user's.
 */
export async function loadDocumentPdfData(
  invoiceId: string,
  userId: string,
): Promise<{ invoice: { number: number }; data: DocumentPdfData } | null> {
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, userId, docType: { not: null } },
    include: { items: true, payments: true, client: true },
  });
  if (!inv) return null;
  const draft = draftFromInvoice(inv);
  if (!draft) return null;
  const owner = await db.user.findUnique({ where: { id: userId }, select: DOC_BUSINESS_SELECT });
  const business = docBusiness(owner);
  return {
    invoice: { number: inv.number },
    data: {
      draft,
      business: {
        ...business,
        // The PDF renderer reads PNG and JPEG only
        logoUrl: pdfLogo(business.logoUrl ?? null),
        signatureUrl: pdfLogo(business.signatureUrl ?? null),
      },
      number: inv.morningDocNumber,
      status: hasDocumentNumber(inv) ? "issued" : "draft",
      producedAt: producedAtNow(),
    },
  };
}
