"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildInvoiceEmail, renderInvoicePdfBuffer } from "@/lib/invoice-email";
import { loadInvoicePdfData } from "@/lib/invoice-pdf-data";
import { createMorningReceipt, getMorningCredentials } from "@/lib/morning";
import { createInvoiceSchema } from "@/server/validators/invoice";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type InvoiceFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export async function createInvoiceAction(
  _: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const userId = await requireUserId();

  // Parse session IDs and custom items from form data
  const sessionIds = formData.getAll("sessionIds").map(String);

  const customItems: { description: string; quantity: string; unitPrice: string }[] = [];
  let i = 0;
  while (formData.has(`customItems[${i}][description]`)) {
    const description = String(formData.get(`customItems[${i}][description]`) ?? "");
    const quantity = String(formData.get(`customItems[${i}][quantity]`) ?? "1");
    const unitPrice = String(formData.get(`customItems[${i}][unitPrice]`) ?? "0");
    if (description.trim()) {
      customItems.push({ description, quantity, unitPrice });
    }
    i++;
  }

  const parsed = createInvoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate") ?? "",
    notes: formData.get("notes") ?? "",
    sessionIds,
    customItems,
  });

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  if (data.sessionIds.length === 0 && data.customItems.length === 0) {
    return { error: "יש לבחור לפחות פגישה אחת או להוסיף שורה" };
  }

  // Verify client + load sessions belonging to this user
  const [client, sessions] = await Promise.all([
    db.client.findFirst({
      where: { id: data.clientId, userId },
      select: { id: true },
    }),
    data.sessionIds.length > 0
      ? db.session.findMany({
          where: {
            id: { in: data.sessionIds },
            userId,
            clientId: data.clientId,
            invoiceItem: null, // not already invoiced
          },
          include: { client: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!client) return { error: "לקוח לא נמצא" };
  if (sessions.length !== data.sessionIds.length) {
    return { error: "אחת או יותר מהפגישות שנבחרו אינן זמינות לחיוב" };
  }

  // Build line items
  const sessionItems = sessions.map((s) => {
    const rate = s.rate ? Number(s.rate) : 0;
    return {
      sessionId: s.id,
      description: `פגישה — ${s.startsAt.toLocaleDateString("he-IL")}`,
      quantity: 1,
      unitPrice: rate,
      amount: rate,
    };
  });

  const customItemRows = data.customItems.map((it) => {
    const amount = it.quantity * it.unitPrice;
    return {
      sessionId: null,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount,
    };
  });

  const allItems = [...sessionItems, ...customItemRows];
  const subtotal = allItems.reduce((sum, it) => sum + it.amount, 0);
  const total = subtotal;

  // Atomic increment for invoice numbering
  const created = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { nextInvoiceNumber: true },
    });
    const number = updated.nextInvoiceNumber - 1;

    return tx.invoice.create({
      data: {
        userId,
        clientId: data.clientId,
        number,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        subtotal,
        total,
        status: "DRAFT",
        items: {
          create: allItems,
        },
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${data.clientId}`);
  redirect(`/invoices/${created.id}`);
}

export async function markInvoiceSentAction(formData: FormData) {
  const userId = await requireUserId();
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
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.invoice.update({
    where: { id, userId },
    data: { status: "CANCELLED" },
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
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

  const result = await createMorningReceipt(userId, creds, {
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
  });

  if (!result.ok) {
    return { error: `הפקת הקבלה נכשלה: ${result.error}` };
  }

  const docUrl = result.data.url?.he ?? result.data.url?.origin ?? null;
  await db.invoice.update({
    where: { id, userId },
    data: { morningDocId: result.data.id, morningDocUrl: docUrl },
  });

  revalidatePath(`/invoices/${id}`);
  return { issued: true, docUrl: docUrl ?? undefined };
}
