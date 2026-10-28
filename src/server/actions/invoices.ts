"use server";

import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly, requireWritable } from "@/lib/subscription-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildInvoiceEmail, renderInvoicePdfBuffer } from "@/lib/invoice-email";
import { loadInvoicePdfData } from "@/lib/invoice-pdf-data";
import { computeInvoiceStatus } from "@/lib/invoice-status";
import { agorotToDecimalString, parseAgorot } from "@/lib/billing-docs";
import {
  buildMorningReceiptPayload,
  createMorningDocument,
  getMorningCredentials,
  morningDocUrl,
} from "@/lib/morning";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function markInvoiceSentAction(formData: FormData) {
  const userId = await requireUserId();
  await requireWritable(userId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.invoice.update({
    where: { id, userId },
    data: { status: "SENT" },
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

export async function cancelInvoiceAction(formData: FormData) {
  const userId = await requireUserId();
  await requireWritable(userId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inv = await db.invoice.findFirst({
    where: { id, userId },
    select: { docType: true, morningDocNumber: true, relatedInvoiceId: true, amountPaid: true, status: true },
  });
  if (!inv || inv.status === "CANCELLED") return;
  // A document issued in morning is cancelled there (credit note / ביטול), not here
  if (inv.docType != null && inv.morningDocNumber) return;

  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id, userId }, data: { status: "CANCELLED" } });
    // A receipt draft for a tax invoice gives the invoice its balance back
    if (inv.docType === 400 && inv.relatedInvoiceId) {
      const rel = await tx.invoice.findFirst({
        where: { id: inv.relatedInvoiceId, userId },
        select: { amountPaid: true, total: true, status: true },
      });
      if (rel) {
        const paid = Math.max(
          0,
          (parseAgorot(rel.amountPaid.toString()) ?? 0) - (parseAgorot(inv.amountPaid.toString()) ?? 0),
        );
        await tx.invoice.update({
          where: { id: inv.relatedInvoiceId },
          data: {
            amountPaid: agorotToDecimalString(paid),
            status: computeInvoiceStatus(rel.status, paid, parseAgorot(rel.total.toString()) ?? 0),
          },
        });
      }
      revalidatePath(`/invoices/${inv.relatedInvoiceId}`);
    }
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export type SendInvoiceEmailState = {
  error?: string;
  sent?: boolean;
} | null;

export async function sendInvoiceEmailAction(
  _: SendInvoiceEmailState,
  formData: FormData,
): Promise<SendInvoiceEmailState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה חשבונית חסר" };

  const loaded = await loadInvoicePdfData(id, userId);
  if (!loaded) return { error: "חשבונית לא נמצאה" };
  const { invoice, data } = loaded;

  if (invoice.status === "CANCELLED") {
    return { error: "לא ניתן לשלוח חשבונית מבוטלת" };
  }
  if (!invoice.client.email) {
    return { error: "ללקוח/ה אין כתובת אימייל — יש להוסיף אותה בכרטיס הלקוח" };
  }

  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdfBuffer(data);
  } catch (err) {
    console.error("Invoice PDF render failed:", err);
    return { error: "יצירת קובץ ה-PDF נכשלה" };
  }

  const businessName = invoice.user.businessName ?? invoice.user.name;
  const { subject, html, text } = buildInvoiceEmail({
    clientFirstName: invoice.client.firstName,
    businessName,
    invoiceNumber: invoice.number,
    issueDate: invoice.issueDate,
    total: Number(invoice.total),
    balance: Number(invoice.total) - Number(invoice.amountPaid),
  });

  const result = await sendEmail({
    to: invoice.client.email,
    subject,
    html,
    text,
    replyTo: invoice.user.email,
    attachments: [
      {
        filename: `invoice-${String(invoice.number).padStart(4, "0")}.pdf`,
        content: pdf,
      },
    ],
  });

  if (!result.ok) {
    return { error: `שליחת האימייל נכשלה: ${result.error}` };
  }

  if (invoice.status === "DRAFT") {
    await db.invoice.update({
      where: { id, userId },
      data: { status: "SENT" },
    });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { sent: true };
}

export type MorningReceiptState = {
  error?: string;
  issued?: boolean;
  docUrl?: string;
} | null;

export async function issueMorningReceiptAction(
  _: MorningReceiptState,
  formData: FormData,
): Promise<MorningReceiptState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה חשבונית חסר" };

  const creds = await getMorningCredentials(userId);
  if (!creds) {
    return { error: "חשבון morning לא מחובר — יש להתחבר בעמוד ההגדרות" };
  }

  const invoice = await db.invoice.findFirst({
    where: { id, userId },
    include: {
      client: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!invoice) return { error: "חשבונית לא נמצאה" };
  if (invoice.status === "CANCELLED") {
    return { error: "לא ניתן להפיק קבלה לחשבונית מבוטלת" };
  }
  if (invoice.morningDocId) {
    return { error: "כבר הופקה קבלה ב-morning עבור חשבונית זו" };
  }
  if (invoice.payments.length === 0) {
    return { error: "אין תשלומים רשומים — קבלה מופקת על תשלומים שהתקבלו" };
  }

  if (invoice.payments.some((p) => p.method === "OTHER")) {
    return {
      error:
        "אחד התשלומים רשום כ״אחר״, ו-morning צריך אמצעי תשלום מוגדר. מחקו אותו ורשמו אותו מחדש עם אמצעי התשלום (ביט, העברה, מזומן…).",
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { morningDocType: true, vatLiable: true },
  });

  const payload = buildMorningReceiptPayload({
    docType: user?.morningDocType ?? 400,
    clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
    clientEmail: invoice.client.email,
    clientTaxId: invoice.client.idNumber,
    clientAddress: invoice.client.address,
    clientPhone: invoice.client.phone,
    description: `קבלה עבור חשבונית #${String(invoice.number).padStart(4, "0")}`,
    items: invoice.items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    })),
    payments: invoice.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      paidAt: p.paidAt,
    })),
    remarks: invoice.notes,
  }, !!user?.vatLiable);
  const result = await createMorningDocument(userId, creds, payload);

  if (!result.ok) {
    return { error: `הפקת הקבלה נכשלה: ${result.error}` };
  }

  const docUrl = morningDocUrl(result.data);
  await db.invoice.update({
    where: { id, userId },
    data: {
      morningDocId: result.data.id,
      morningDocUrl: docUrl,
      morningDocNumber: result.data.number != null ? String(result.data.number) : null,
    },
  });

  revalidatePath(`/invoices/${id}`);
  // The Morning doc number surfaces on the client card and treatment pages too
  revalidatePath(`/clients/${invoice.clientId}`);
  for (const it of invoice.items) {
    if (it.sessionId) revalidatePath(`/sessions/${it.sessionId}`);
  }
  return { issued: true, docUrl: docUrl ?? undefined };
}
