import "./zod-hebrew";
import { z } from "zod";
import { CARD_TYPES, DEAL_TYPES, DOC_CURRENCIES, DOC_LANGS, PAYMENT_KINDS, parseAgorot } from "@/lib/billing-docs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const amount = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    if (v === "") return 0;
    const a = parseAgorot(v);
    if (a === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "סכום לא תקין" });
      return z.NEVER;
    }
    return a;
  });

// Shapes and limits only. Whether a document is complete is documentProblems'
// job, so that an unfinished form can still be kept as a draft.
export const documentItemSchema = z.object({
  description: z.string().trim().max(200),
  quantity: z.coerce.number().min(0).max(1000),
  unitPrice: amount,
});

export const documentPaymentSchema = z.object({
  method: z.enum(PAYMENT_KINDS),
  date,
  amount,
  bankName: optionalText(60),
  bankBranch: optionalText(20),
  bankAccount: optionalText(30),
  chequeNumber: optionalText(30),
  cardType: z.enum(CARD_TYPES).optional().or(z.literal("")),
  cardLast4: optionalText(4),
  dealType: z.enum(DEAL_TYPES).optional().or(z.literal("")),
  installments: z.coerce.number().int().min(1).max(36).optional().or(z.literal("")),
  reference: optionalText(100),
});

/** What the "מסמך חדש" form sends (as JSON). */
export const documentDraftSchema = z.object({
  kind: z.enum(["TAX_INVOICE", "TAX_INVOICE_RECEIPT", "RECEIPT", "CREDIT_NOTE"]),
  /** empty = a one-off client ("לקוח מזדמן"): the name is all there is */
  clientId: z.string().optional().or(z.literal("")),
  clientName: z.string().trim().max(120),
  clientTaxId: optionalText(20),
  clientEmails: z.array(z.string().trim().max(200)).max(10).default([]),
  date,
  dueDate: date.optional().or(z.literal("")),
  vatIncluded: z.boolean().default(true),
  currency: z.enum(DOC_CURRENCIES).default("ILS"),
  lang: z.enum(DOC_LANGS).default("he"),
  vatType: z.union([z.literal(0), z.literal(1)]).default(0),
  rounding: z.boolean().default(false),
  description: optionalText(300),
  remarks: optionalText(1000),
  items: z.array(documentItemSchema).max(50).default([]),
  payments: z.array(documentPaymentSchema).max(20).default([]),
  /** meetings ticked: internal, never on the document */
  sessionIds: z.array(z.string().min(1)).max(100).default([]),
  /** the saved draft this form is editing */
  draftId: z.string().optional().or(z.literal("")),
  /** a receipt: the tax invoice (305) it pays. A credit note: the document it cancels */
  relatedInvoiceId: z.string().optional().or(z.literal("")),
});

export type DocumentDraftInput = z.infer<typeof documentDraftSchema>;
