"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recordPaymentSchema } from "@/server/validators/invoice";

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
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Verify invoice belongs to this user
  const invoice = await db.invoice.findFirst({
    where: { id: data.invoiceId, userId },
    select: { id: true, total: true, amountPaid: true, status: true },
  });
  if (!invoice) return { error: "חשבונית לא נמצאה" };
  if (invoice.status === "CANCELLED") {
    return { error: "לא ניתן לרשום תשלום לחשבונית מבוטלת" };
  }

  // Insert payment + recalculate amountPaid + flip status atomically
  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
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
    const amountPaid = Number(agg._sum.amount ?? 0);
    const total = Number(invoice.total);

    let status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" = invoice.status as never;
    if (amountPaid >= total) status = "PAID";
    else if (amountPaid > 0) status = "PARTIALLY_PAID";

    await tx.invoice.update({
      where: { id: data.invoiceId },
      data: { amountPaid, status },
    });
  });

  revalidatePath(`/invoices/${data.invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function deletePaymentAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Verify ownership through the invoice relation
  const payment = await db.payment.findFirst({
    where: { id, invoice: { userId } },
    select: { id: true, invoiceId: true },
  });
  if (!payment) return;

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
    const amountPaid = Number(agg._sum.amount ?? 0);
    const total = Number(inv.total);

    let status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" =
      inv.status === "DRAFT" ? "DRAFT" : "SENT";
    if (amountPaid >= total) status = "PAID";
    else if (amountPaid > 0) status = "PARTIALLY_PAID";

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid, status },
    });
  });

  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/invoices");
}
