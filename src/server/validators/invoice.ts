import "./zod-hebrew";
import { z } from "zod";

const decimalish = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : parseFloat(v)))
  .pipe(z.number().min(0));

export const paymentMethods = [
  "CASH",
  "BIT",
  "PAYBOX",
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
