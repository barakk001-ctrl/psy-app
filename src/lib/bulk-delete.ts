// "Delete all of this client's future meetings" — for a client who stopped
// coming. Pure rules; the server action loads the meetings and applies them.
//
// Only meetings that start after now are ever considered, and of those only
// the empty ones are deleted: a meeting with a clinical note, an attachment, a
// payment record, an app invoice or a Morning document number holds clinical
// or billing records and is kept (cancelled instead, so no reminder goes out).

export type BulkDeleteCandidate = {
  id: string;
  startsAt: Date;
  hasNote: boolean;
  fileCount: number;
  hasInvoiceItem: boolean;
  paymentStatus: string | null;
  paidAmount: unknown;
  morningDocNumber: string | null;
  morningReceiptNumber: string | null;
  morningInvoiceReceiptNumber: string | null;
};

export type KeepReason = "note" | "files" | "payment" | "invoice" | "morning";

export const KEEP_REASON_LABELS: Record<KeepReason, string> = {
  note: "סיכום",
  files: "קבצים מצורפים",
  payment: "רישום תשלום",
  invoice: "חשבונית",
  morning: "מסמך Morning",
};

export function keepReasons(s: BulkDeleteCandidate): KeepReason[] {
  const reasons: KeepReason[] = [];
  if (s.hasNote) reasons.push("note");
  if (s.fileCount > 0) reasons.push("files");
  if (s.paymentStatus || (s.paidAmount !== null && s.paidAmount !== undefined)) {
    reasons.push("payment");
  }
  if (s.hasInvoiceItem) reasons.push("invoice");
  if (s.morningDocNumber || s.morningReceiptNumber || s.morningInvoiceReceiptNumber) {
    reasons.push("morning");
  }
  return reasons;
}

export type BulkDeletePlan = {
  /** future and empty — deleted */
  deleteIds: string[];
  /** future but holding records — kept (and cancelled) */
  keep: { id: string; reasons: KeepReason[] }[];
};

export function planFutureDelete(
  sessions: BulkDeleteCandidate[],
  now: Date,
): BulkDeletePlan {
  const plan: BulkDeletePlan = { deleteIds: [], keep: [] };
  for (const s of sessions) {
    if (s.startsAt.getTime() <= now.getTime()) continue; // never the past
    const reasons = keepReasons(s);
    if (reasons.length) plan.keep.push({ id: s.id, reasons });
    else plan.deleteIds.push(s.id);
  }
  return plan;
}

/** Hebrew summary of the kept meetings' reasons, e.g. "סיכום, רישום תשלום". */
export function keepReasonsText(keep: BulkDeletePlan["keep"]): string {
  const all = new Set<KeepReason>();
  for (const k of keep) k.reasons.forEach((r) => all.add(r));
  return [...all].map((r) => KEEP_REASON_LABELS[r]).join(", ");
}
