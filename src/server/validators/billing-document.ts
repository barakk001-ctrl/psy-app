import "./zod-hebrew";
import { z } from "zod";
import { CARD_TYPES, DEAL_TYPES, PAYMENT_KINDS, parseAgorot } from "@/lib/billing-docs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const amount = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const a = parseAgorot(v);
    if (a === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "סכום לא תקין" });
      return z.NEVER;
    }
    return a;
  });

export const documentItemSchema = z.object({
  description: z.string().trim().min(1, "נדרש תיאור").max(200),
  quantity: z.coerce.number().positive("כמות חייבת להיות גדולה מאפס").max(1000),
  unitPrice: amount,
  sessionId: z.string().optional().or(z.literal("")),
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
  kind: z.enum(["TAX_INVOICE", "TAX_INVOICE_RECEIPT", "RECEIPT"]),
  clientId: z.string().min(1, "נדרש לקוח/ה"),
  clientName: z.string().trim().min(1, "נדרש שם על המסמך").max(120),
  clientTaxId: optionalText(20),
  clientEmail: z.string().trim().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  date,
  dueDate: date.optional().or(z.literal("")),
  vatIncluded: z.boolean().default(true),
  description: optionalText(300),
  remarks: optionalText(1000),
  items: z.array(documentItemSchema).max(50).default([]),
  payments: z.array(documentPaymentSchema).max(20).default([]),
  /** a receipt for this tax invoice (305) */
  relatedInvoiceId: z.string().optional().or(z.literal("")),
});

export type DocumentDraftInput = z.infer<typeof documentDraftSchema>;
