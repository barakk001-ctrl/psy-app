"use server";

import { documentsEnabled, DOCUMENTS_OFF_ERROR, DOCUMENTS_OFF_PATH } from "@/lib/features";
import { redirect } from "next/navigation";

import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly, requireWritable } from "@/lib/subscription-server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { computeInvoiceStatus } from "@/lib/invoice-status";
import { recordPaymentSchema } from "@/server/validators/invoice";
import {
  agorotToDecimalString,
  decimalToAgorot,
  formatDocMoney,
  olderInvoiceRefusal,
  parseAgorot,
} from "@/lib/billing-docs";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type PaymentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  saved?: boolean;
} | null;

export async function recordPaymentAction(
  _: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidAt: formData.get("paidAt"),
    reference: formData.get("reference") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  // Money in whole agorot from here on: no float sums
  const amountAgorot = parseAgorot(String(formData.get("amount") ?? ""));
  if (!amountAgorot) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
      fieldErrors: { amount: ["סכום לא תקין (עד שתי ספרות אחרי הנקודה)"] },
    };
  }

  // Verify invoice belongs to this user
  const invoice = await db.invoice.findFirst({
    where: { id: data.invoiceId, userId },
    select: {
      id: true,
      total: true,
      amountPaid: true,
      status: true,
      docType: true,
      morningDocId: true,
      morningDocNumber: true,
    },
  });
  if (!invoice) return { error: "חשבונית לא נמצאה" };
  // Only an older invoice nothing was issued for takes payments one by one
  const refusal = olderInvoiceRefusal(invoice);
  if (refusal) return { error: refusal };
  if (invoice.status === "CANCELLED") {
    return { error: "לא ניתן לרשום תשלום לחשבונית מבוטלת" };
  }

  const totalAgorot = decimalToAgorot(invoice.total);
  const remaining = totalAgorot - decimalToAgorot(invoice.amountPaid);
  if (amountAgorot > remaining) {
    return {
      error: `הסכום גבוה מהיתרה לתשלום (${formatDocMoney(Math.max(remaining, 0))})`,
      fieldErrors: { amount: ["הסכום גבוה מהיתרה לתשלום"] },
    };
  }

  // Insert payment + recalculate amountPaid + flip status atomically
  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: agorotToDecimalString(amountAgorot),
        method: data.method,
        paidAt: new Date(data.paidAt),
        reference: data.reference || null,
        notes: data.notes || null,
      },
    });

    const agg = await tx.payment.aggregate({
      where: { invoiceId: data.invoiceId },
      _sum: { amount: true },
    });
    const paidAgorot = decimalToAgorot(agg._sum.amount);

    await tx.invoice.update({
      where: { id: data.invoiceId },
      data: {
        amountPaid: agorotToDecimalString(paidAgorot),
        status: computeInvoiceStatus(invoice.status, paidAgorot, totalAgorot),
      },
    });
  });

  revalidatePath(`/invoices/${data.invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { saved: true };
}

export async function deletePaymentAction(formData: FormData) {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) redirect(DOCUMENTS_OFF_PATH);
  await requireWritable(userId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Verify ownership through the invoice relation
  const payment = await db.payment.findFirst({
    where: { id, invoice: { userId } },
    select: {
      id: true,
      invoiceId: true,
      invoice: { select: { docType: true, morningDocId: true, morningDocNumber: true } },
    },
  });
  if (!payment) return;
  // A document's payments are its own: never removed one by one here
  if (olderInvoiceRefusal(payment.invoice)) return;

  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });

    const inv = await tx.invoice.findUnique({
      where: { id: payment.invoiceId },
      select: { total: true, status: true },
    });
    if (!inv) return;

    const agg = await tx.payment.aggregate({
      where: { invoiceId: payment.invoiceId },
      _sum: { amount: true },
    });
    const paidAgorot = decimalToAgorot(agg._sum.amount);

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaid: agorotToDecimalString(paidAgorot),
        status: computeInvoiceStatus(inv.status, paidAgorot, decimalToAgorot(inv.total)),
      },
    });
  });

  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
