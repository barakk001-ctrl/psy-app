import { db } from "@/lib/db";
import type { InvoicePDFData } from "@/components/invoices/invoice-pdf";

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
    },
    client: {
      firstName: invoice.client.firstName,
      lastName: invoice.client.lastName,
      idNumber: invoice.client.idNumber,
      address: invoice.client.address,
      email: invoice.client.email,
      phone: invoice.client.phone,
    },
    items: invoice.items.map((it) => ({
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
