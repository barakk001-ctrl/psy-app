export type ComputedInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

/**
 * Payment-driven invoice status. Cancelled invoices stay cancelled; otherwise
 * the status follows the paid amount, falling back to DRAFT/SENT when nothing
 * has been paid.
 */
export function computeInvoiceStatus(
  current: string,
  amountPaid: number,
  total: number,
): ComputedInvoiceStatus {
  if (current === "CANCELLED") return "CANCELLED";
  if (total > 0 && amountPaid >= total) return "PAID";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  return current === "DRAFT" ? "DRAFT" : "SENT";
}
