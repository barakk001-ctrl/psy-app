"use client";

import { PdfButton } from "@/components/ui/pdf-button";

export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: number;
}) {
  return (
    <PdfButton
      url={`/api/invoices/${invoiceId}/pdf`}
      fileName={`invoice-${String(invoiceNumber).padStart(4, "0")}.pdf`}
    />
  );
}
