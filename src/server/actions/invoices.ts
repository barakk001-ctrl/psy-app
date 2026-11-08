"use server";

import { documentsEnabled, DOCUMENTS_OFF_ERROR, DOCUMENTS_OFF_PATH } from "@/lib/features";

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
import { agorotToDecimalString, hasDocumentNumber, olderInvoiceRefusal, parseAgorot } from "@/lib/billing-docs";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function markInvoiceSentAction(formData: FormData) {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) redirect(DOCUMENTS_OFF_PATH);
  await requireWritable(userId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Older app invoices only: a document's status follows its number and payments
  const inv = await db.invoice.findFirst({
    where: { id, userId },
    select: { docType: true, morningDocId: true, morningDocNumber: true },
  });
  if (!inv || olderInvoiceRefusal(inv)) return;

  await db.invoice.update({
    where: { id, userId },
    data: { status: "SENT" },
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

export async function cancelInvoiceAction(formData: FormData) {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) redirect(DOCUMENTS_OFF_PATH);
  await requireWritable(userId);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inv = await db.invoice.findFirst({
    where: { id, userId },
    select: { docType: true, morningDocNumber: true, relatedInvoiceId: true, amountPaid: true, status: true },
  });
  if (!inv || inv.status === "CANCELLED") return;
  // An issued document is cancelled where it was issued (credit note / ביטול), not here
  if (inv.docType != null && hasDocumentNumber(inv)) return;

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
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה חשבונית חסר" };

  const loaded = await loadInvoicePdfData(id, userId);
  if (!loaded) return { error: "חשבונית לא נמצאה" };
  const { invoice, data } = loaded;

  if (invoice.status === "CANCELLED") {
    return { error: "לא ניתן לשלוח חשבונית מבוטלת" };
  }
  const client = invoice.client;
  if (!client?.email) {
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
    clientFirstName: client.firstName,
    businessName,
    invoiceNumber: invoice.number,
    issueDate: invoice.issueDate,
    total: Number(invoice.total),
    balance: Number(invoice.total) - Number(invoice.amountPaid),
  });

  const result = await sendEmail({
    to: client.email,
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
