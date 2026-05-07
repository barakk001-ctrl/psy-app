import { z } from "zod";

const decimalish = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : parseFloat(v)))
  .pipe(z.number().min(0));

export const lineItemSchema = z.object({
  description: z.string().min(1, "נדרש תיאור").max(200),
  quantity: decimalish,
  unitPrice: decimalish,
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, "נדרש לקוח"),
  issueDate: z.string().min(1, "נדרש תאריך"),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Sessions selected from the client's uninvoiced completed sessions
  sessionIds: z.array(z.string()).default([]),
  // Free-form additional line items
  customItems: z.array(lineItemSchema).default([]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const paymentMethods = [
  "CASH",
  "BIT",
  "CHECK",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "PAYPAL",
  "OTHER",
] as const;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: decimalish.refine((v) => v > 0, "סכום חייב להיות גדול מאפס"),
  method: z.enum(paymentMethods),
  paidAt: z.string().min(1, "נדרש תאריך"),
  reference: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
