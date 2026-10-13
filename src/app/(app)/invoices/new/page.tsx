import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMorningCredentials } from "@/lib/morning";
import { creatableKinds, defaultKind, DOC_KINDS, type DocKind } from "@/lib/billing-docs";
import { clinicDay } from "@/lib/billing-doc-data";
import { DocumentForm } from "@/components/invoices/document-form";

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);

/**
 * "מסמך חדש" in morning's order: type → client and dates → income lines
 * (meetings) → receipt lines → notes → preview → issue in morning (or save a
 * draft when morning isn't connected).
 */
export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; sessionId?: string; kind?: string; forInvoice?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const [owner, clients, sessions, creds] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        businessName: true,
        businessId: true,
        address: true,
        phone: true,
        vatLiable: true,
        morningDocType: true,
      },
    }),
    db.client.findMany({
      // Inactive clients too (listed after the active ones)
      where: { userId },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, idNumber: true, email: true, defaultRate: true },
    }),
    // Meetings that took place (or were missed) and aren't billed yet
    db.session.findMany({
      where: {
        userId,
        invoiceItem: null,
        OR: [
          { status: { in: ["COMPLETED", "NO_SHOW"] } },
          { status: "SCHEDULED", startsAt: { lt: now } },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 400,
      select: { id: true, clientId: true, startsAt: true, rate: true, treatmentType: true, status: true },
    }),
    getMorningCredentials(userId),
  ]);
  const vatLiable = !!owner?.vatLiable;

  // A receipt for a tax invoice (from that invoice's page)
  const forInvoice = params.forInvoice
    ? await db.invoice.findFirst({
        where: { id: params.forInvoice, userId, docType: DOC_KINDS.TAX_INVOICE.code, status: { not: "CANCELLED" } },
        select: { id: true, clientId: true, total: true, amountPaid: true, morningDocNumber: true, number: true },
      })
    : null;

  // The meeting she came from (session page "הפקת מסמך")
  const fromSession = params.sessionId ? sessions.find((s) => s.id === params.sessionId) : undefined;
  const clientId = forInvoice?.clientId ?? fromSession?.clientId ?? params.clientId;

  const kinds = creatableKinds(vatLiable).map((k) => k.kind);
  const requested = kinds.find((k) => k === params.kind) as DocKind | undefined;
  const initialKind = requested ?? defaultKind(vatLiable, owner?.morningDocType);

  const balance = forInvoice
    ? (Number(forInvoice.total.toString()) - Number(forInvoice.amountPaid.toString())).toFixed(2)
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={forInvoice ? `/invoices/${forInvoice.id}` : "/invoices"}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        {forInvoice ? "חזרה לחשבונית" : "חזרה לחשבוניות וקבלות"}
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">{forInvoice ? "קבלה על חשבונית" : "מסמך חדש"}</h1>
        <p className="text-ink-muted text-sm mt-1">
          {creds
            ? "ממלאים כמו ב-morning, בודקים בתצוגה המקדימה, והמסמך מופק ב-morning — המספר והקישור נשמרים כאן."
            : "ממלאים, בודקים בתצוגה המקדימה ושומרים כטיוטה. morning לא מחובר, אז את המסמך הרשמי מפיקים שם (הפרטים מוכנים להעתקה)."}
        </p>
      </header>
      <DocumentForm
        kinds={kinds}
        initialKind={initialKind}
        today={clinicDay(now)}
        morningConnected={!!creds}
        business={{
          name: owner?.businessName ?? owner?.name ?? "",
          businessId: owner?.businessId ?? null,
          address: owner?.address ?? null,
          phone: owner?.phone ?? null,
          vatLiable,
        }}
        clients={clients.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          idNumber: c.idNumber,
          email: c.email,
          rate: c.defaultRate ? c.defaultRate.toString() : null,
        }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          clientId: s.clientId,
          day: dayLabel(s.startsAt),
          label: `${dayLabel(s.startsAt)} · ${s.treatmentType}${s.status === "NO_SHOW" ? " · לא התקיימה" : ""}`,
          rate: s.rate ? s.rate.toString() : null,
        }))}
        initial={{
          clientId: clientId ?? undefined,
          sessionIds: fromSession ? [fromSession.id] : undefined,
          relatedInvoice:
            forInvoice && balance
              ? {
                  id: forInvoice.id,
                  label: `חשבונית מס ${forInvoice.morningDocNumber ?? `#${forInvoice.number}`}`,
                  balance,
                }
              : undefined,
        }}
      />
    </div>
  );
}
