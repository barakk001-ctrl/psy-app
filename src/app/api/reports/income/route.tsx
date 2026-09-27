import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { clientBreakdown, PAYMENT_METHOD_LABELS, sessionPaymentAmount, tookPlace } from "@/lib/income";
import { loadInvoicePayments, loadSessions } from "@/lib/income-data";
import { parseDateRange, rangeLabel, summarizeIncome } from "@/lib/report-periods";
import { IncomePDF } from "@/components/reports/income-pdf";
import { pdfResponse } from "@/components/pdf/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "02.09.26 12:00" — built from parts so there's no locale comma to reorder
const PARTS = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jerusalem",
});
function shortDate(d: Date, withTime: boolean): string {
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.day}.${p.month}.${p.year}`;
  return withTime ? `${date} ${p.hour}:${p.minute}` : date;
}

const method = (m: string | null) => (m ? (PAYMENT_METHOD_LABELS[m] ?? m) : "—");

// Income report PDF for ?from=yyyy-mm-dd&to=yyyy-mm-dd (clinic calendar days,
// both inclusive). Middleware skips /api, so this route guards itself.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const parsed = parseDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!parsed) return new Response("טווח תאריכים לא תקין", { status: 400 });
  const [from, to] = parsed.range;

  const now = new Date();
  const [payments, sessions, user] = await Promise.all([
    loadInvoicePayments(userId, from, to),
    loadSessions(userId, from, to),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, businessName: true, brandName: true },
    }),
  ]);
  const summary = summarizeIncome(payments, sessions, now);

  const statusLabel = (s: (typeof sessions)[number]) =>
    s.status === "CANCELLED"
      ? "בוטלה"
      : s.status === "NO_SHOW"
        ? "לא התקיימה"
        : tookPlace(s, now)
          ? "התקיימה"
          : "מתוכננת";
  const paidLabel = (s: (typeof sessions)[number]) => {
    const amount = sessionPaymentAmount(s);
    if (amount > 0) return formatCurrency(amount);
    if (s.hasInvoice) return "בחשבונית";
    if (s.paymentStatus === "EXEMPT") return "ללא תשלום";
    if (s.paymentStatus === "UNPAID") return "טרם שולם";
    return "—";
  };

  return pdfResponse(
    <IncomePDF
      data={{
        practiceName: user?.brandName || user?.businessName || user?.name || "",
        periodLabel: rangeLabel(parsed.from, parsed.to),
        generatedAt: formatDate(now),
        received: formatCurrency(summary.received),
        expected: formatCurrency(summary.expected),
        held: summary.sessionsHeld,
        cancelled: summary.sessionsCancelled,
        receivedFromSessions: formatCurrency(summary.receivedFromSessions),
        receivedFromInvoices: formatCurrency(summary.receivedFromInvoices),
        hasInvoicePayments: payments.length > 0,
        clients: clientBreakdown(sessions, summary.entries, now).map((c) => ({
          name: c.name,
          held: c.held,
          expected: formatCurrency(c.expected),
          received: formatCurrency(c.received),
        })),
        methods: summary.byMethod.map((m) => ({
          label: m.label,
          count: m.count,
          total: formatCurrency(m.total),
        })),
        sessions: sessions.map((s) => ({
          date: shortDate(s.startsAt, true),
          client: s.clientName,
          status: statusLabel(s),
          rate: s.rate === null ? "—" : formatCurrency(s.rate),
          paid: paidLabel(s),
          method: sessionPaymentAmount(s) > 0 ? method(s.paymentMethod) : "",
        })),
        invoicePayments: payments.map((p) => ({
          date: shortDate(p.paidAt, false),
          client: p.clientName,
          amount: formatCurrency(p.amount),
          method: method(p.method),
        })),
      }}
    />,
    `income-${parsed.from}-${parsed.to}.pdf`,
  );
}
