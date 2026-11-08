"use server";

import { documentsEnabled, DOCUMENTS_OFF_ERROR } from "@/lib/features";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { agorotToDecimalString } from "@/lib/billing-docs";
import { checkDocument } from "@/lib/client-documents";
import { saveDocumentBytes } from "@/lib/document-storage";
import { expenseStore } from "@/lib/expense-storage";
import { draftAmount, expenseProblems, type ExpenseDetails } from "@/lib/expenses";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly } from "@/lib/subscription-server";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type ExpenseResult = { ok: true; id: string } | { error: string; problems?: string[] };

const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? "").trim().slice(0, max);

function revalidateExpenses(id?: string) {
  revalidatePath("/expenses");
  if (id) revalidatePath(`/expenses/${id}`);
}

/** One file per call, as with client documents. It starts as a draft to fill in. */
export async function uploadExpenseAction(formData: FormData): Promise<ExpenseResult> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "לא נבחר קובץ" };
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkDocument({ name: file.name, size: file.size }, bytes);
  if (!check.ok) return { error: check.error };

  const expense = await db.expense.create({
    data: {
      userId,
      nameCiphertext: encryptSecret(check.name),
      mimeType: check.mimeType,
      size: bytes.length,
    },
    select: { id: true },
  });
  try {
    await saveDocumentBytes(expenseStore, expense.id, bytes);
  } catch (err) {
    // Never leave an expense without its file
    await db.expense.deleteMany({ where: { id: expense.id, userId } }).catch(() => {});
    console.error("Expense upload failed:", err instanceof Error ? err.message : err);
    return { error: "שמירת הקובץ נכשלה — נסו שוב" };
  }
  revalidateExpenses();
  return { ok: true, id: expense.id };
}

/** The form below the file: "אישור" checks it, "העברה לטיוטה" keeps it as it is. */
export async function saveExpenseAction(formData: FormData): Promise<ExpenseResult> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = text(formData, "id", 60);
  const approve = text(formData, "intent", 10) === "approve";
  if (!id) return { error: "מזהה ההוצאה חסר" };

  const rawType = Number(formData.get("docType"));
  const details: ExpenseDetails = {
    docType: Number.isInteger(rawType) && rawType > 0 ? rawType : null,
    docDate: text(formData, "docDate", 10),
    supplier: text(formData, "supplier", 120),
    docNumber: text(formData, "docNumber", 40),
    amount: text(formData, "amount", 20),
    vatAmount: text(formData, "vatAmount", 20),
  };
  if (approve) {
    const problems = expenseProblems(details);
    if (problems.length) return { error: "אי אפשר עדיין לאשר את ההוצאה:", problems };
  }

  const amount = draftAmount(details.amount);
  const vat = draftAmount(details.vatAmount);
  const { count } = await db.expense.updateMany({
    where: { id, userId },
    data: {
      status: approve ? "APPROVED" : "DRAFT",
      docType: details.docType,
      docDate: /^\d{4}-\d{2}-\d{2}$/.test(details.docDate) ? new Date(`${details.docDate}T00:00:00.000Z`) : null,
      supplier: details.supplier || null,
      docNumber: details.docNumber || null,
      amount: amount !== null ? agorotToDecimalString(amount) : null,
      vatAmount: vat !== null ? agorotToDecimalString(vat) : null,
    },
  });
  if (count === 0) return { error: "ההוצאה לא נמצאה" };
  revalidateExpenses(id);
  return { ok: true, id };
}

export async function deleteExpenseAction(formData: FormData): Promise<ExpenseResult> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = text(formData, "id", 60);
  if (!id) return { error: "מזהה ההוצאה חסר" };
  const expense = await db.expense.findFirst({ where: { id, userId }, select: { id: true } });
  if (!expense) return { error: "ההוצאה לא נמצאה" };
  // The bytes first (an object-store backend has no cascade), then the row
  await expenseStore.delete(expense.id);
  await db.expense.deleteMany({ where: { id: expense.id, userId } });
  revalidateExpenses(id);
  return { ok: true, id };
}
