import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PdfButton } from "@/components/ui/pdf-button";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpensePdfView } from "@/components/expenses/expense-pdf-view";
import { clinicDay } from "@/lib/billing-doc-data";
import { decryptSecret } from "@/lib/crypto";

export const metadata = { title: "מסמך הוצאה — מרפאה אישית" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { id } = await params;

  const expense = await db.expense.findFirst({ where: { id, userId } });
  if (!expense) notFound();

  let name = "קובץ";
  try {
    name = decryptSecret(expense.nameCiphertext);
  } catch {
    // The details still open; the file name isn't what she came for
  }
  const src = `/api/expenses/${expense.id}`;
  const isImage = expense.mimeType.startsWith("image/") && !/hei[cf]/.test(expense.mimeType);
  const isPdf = expense.mimeType === "application/pdf";

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה למסמכי הוצאות
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              expense.status === "APPROVED" ? "bg-sage-100 text-sage-700" : "bg-gold-200 text-ink"
            }`}
          >
            {expense.status === "APPROVED" ? "מאושר" : "טיוטה"}
          </span>
          <h1 className="font-display text-3xl text-ink mt-2">מסמך הוצאה</h1>
          <p className="text-ink-muted text-sm mt-1 break-all">{name}</p>
        </div>
        <PdfButton url={`${src}?download=1`} fileName={name} label="הורדה" />
      </header>

      <Card className="overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`הקובץ ${name}`} className="w-full max-h-[70dvh] object-contain bg-cream-100" />
        ) : isPdf ? (
          <ExpensePdfView src={src} title={`הקובץ ${name}`} />
        ) : (
          <CardContent>
            <p className="text-sm text-ink-muted">
              אי אפשר להציג את הקובץ הזה כאן. פותחים אותו ב״הורדה״.
            </p>
          </CardContent>
        )}
      </Card>

      <ExpenseForm
        id={expense.id}
        today={clinicDay(new Date())}
        initial={{
          docType: expense.docType,
          docDate: expense.docDate ? clinicDay(expense.docDate) : "",
          supplier: expense.supplier ?? "",
          docNumber: expense.docNumber ?? "",
          amount: expense.amount?.toString() ?? "",
          vatAmount: expense.vatAmount?.toString() ?? "",
        }}
      />
    </div>
  );
}
