import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { ClinicHero } from "@/components/dashboard/clinic-hero";
import { AgreementBanner } from "@/components/dashboard/agreement-banner";
import { ExplainerVideo } from "@/components/auth/explainer-video";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { TodoCard } from "@/components/dashboard/todo-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";
import {
  Calendar,
  UserPlus,
  FileText,
  ClipboardPaste,
  NotebookPen,
  Receipt,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Today's bounds by the clinic's wall clock (server runs in UTC)
  const todayLocal = toZonedDateTimeLocal(now).slice(0, 10);
  const [ty, tm, td] = todayLocal.split("-").map(Number);
  const tomorrowLocal = new Date(Date.UTC(ty, tm - 1, td + 1))
    .toISOString()
    .slice(0, 10);
  const dayStart = fromZonedDateTimeLocal(`${todayLocal}T00:00`);
  const dayEnd = fromZonedDateTimeLocal(`${tomorrowLocal}T00:00`);

  const [activeClients, todaySessions, monthPayments, outstanding, todos, monthExpected, monthSessionPaid, me] = await Promise.all([
    db.client.count({ where: { userId, status: "ACTIVE" } }),
    db.session.findMany({
      // All of today's meetings — the ones that already happened included,
      // so payments and notes can be caught up from here
      where: {
        userId,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: { not: "CANCELLED" },
      },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: {
        client: { select: { firstName: true, lastName: true } },
        invoiceItem: { select: { invoiceId: true } },
        note: { select: { id: true } },
      },
    }),
    db.payment.aggregate({
      where: {
        invoice: { userId },
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      // Drafts count too — an unpaid invoice is a debt even before it's sent
      where: { userId, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
      _sum: { total: true, amountPaid: true },
    }),
    db.todo.findMany({
      where: { userId },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
      take: 20,
      select: { id: true, text: true, done: true },
    }),
    // Expected income: rates of this month's scheduled + completed meetings
    db.session.aggregate({
      where: {
        userId,
        startsAt: { gte: monthStart, lt: monthEnd },
        status: { in: ["SCHEDULED", "COMPLETED"] },
      },
      _sum: { rate: true },
    }),
    // Quick per-meeting payments (Morning-first flow) — only for meetings
    // without an app invoice, so nothing double-counts
    db.session.aggregate({
      where: {
        userId,
        startsAt: { gte: monthStart, lt: monthEnd },
        paymentStatus: "PAID",
        invoiceItem: { is: null },
      },
      _sum: { paidAmount: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { agreementVersion: true, name: true },
    }),
  ]);
  const needsAgreement = me?.agreementVersion !== AGREEMENT_VERSION;

  const monthIncome =
    Number(monthPayments._sum.amount ?? 0) +
    Number(monthSessionPaid._sum.paidAmount ?? 0);
  const outstandingAmount =
    Number(outstanding._sum.total ?? 0) - Number(outstanding._sum.amountPaid ?? 0);

  const nowMs = now.getTime();
  const isInProgress = (s: { startsAt: Date; endsAt: Date }) =>
    s.startsAt.getTime() <= nowMs && s.endsAt.getTime() >= nowMs;
  const isOver = (s: { endsAt: Date }) => s.endsAt.getTime() < nowMs;
  const nextSessionId = todaySessions.find((s) => s.startsAt.getTime() > nowMs)?.id;

  return (
    <div className="space-y-8">
      {needsAgreement && <AgreementBanner />}
      <header className="relative overflow-hidden rounded-3xl border border-cream-200/80 bg-gradient-to-l from-sage-50 via-cream-100 to-cream-50 shadow-soft">
        {/* Clinic-room illustration sits at the far (physical-left) edge in RTL */}
        <ClinicHero className="pointer-events-none select-none absolute inset-y-2 left-4 h-[calc(100%-1rem)] w-auto opacity-30 sm:opacity-100" />
        <div className="relative px-6 py-7 sm:px-8 sm:max-w-[60%]">
          <p className="text-sm text-ink-muted">
            {new Intl.DateTimeFormat("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Jerusalem",
            }).format(now)}
          </p>
          <h1 className="font-display text-4xl text-ink mt-1">
            שלום, {(me?.name ?? session!.user.name)?.split(" ")[0]}
          </h1>
          <p className="text-sm text-ink-muted mt-1.5">ברוכה הבאה למרפאה האישית שלך 🌿</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href="/clients/new">
              <Button variant="secondary" size="sm">
                <UserPlus className="w-4 h-4" /> לקוח חדש
              </Button>
            </Link>
            <Link href="/calendar">
              <Button size="sm">
                <Calendar className="w-4 h-4" /> פגישה חדשה
              </Button>
            </Link>
          </div>
          <ExplainerVideo
            label="סרטון היכרות עם המערכת"
            className="mt-3 flex items-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 font-medium"
          />
        </div>
      </header>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard label="לקוחות פעילים" value={activeClients} />
        <StatCard
          label="הכנסה צפויה החודש"
          value={formatCurrency(Number(monthExpected._sum.rate ?? 0))}
          hint="לפי הפגישות ביומן החודש"
        />
        <StatCard
          label="הכנסות החודש"
          value={formatCurrency(monthIncome)}
          hint={new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(now)}
        />
        <StatCard
          label="חוב פתוח"
          value={formatCurrency(outstandingAmount)}
          hint="חשבוניות שטרם שולמו במלואן"
        />
        <StatCard label="פגישות היום" value={todaySessions.length} hint="ביומן היום" />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <Link
          href="/document"
          className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-cream-200/80 shadow-soft px-4 py-4 hover:shadow-lift transition-all active:scale-[0.98]"
        >
          <span className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center shrink-0">
            <NotebookPen className="w-5 h-5" />
          </span>
          <span className="font-medium text-ink text-sm sm:text-base">
            תיעוד פגישות
          </span>
        </Link>
        <Link
          href="/collect"
          className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-cream-200/80 shadow-soft px-4 py-4 hover:shadow-lift transition-all active:scale-[0.98]"
        >
          <span className="w-10 h-10 rounded-xl bg-sage-100 text-sage-700 grid place-items-center shrink-0">
            <Receipt className="w-5 h-5" />
          </span>
          <span className="font-medium text-ink text-sm sm:text-base">
            אישורי תשלום
          </span>
        </Link>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>הפגישות של היום</CardTitle>
              <CardDescription>כל הפגישות ביומן היום</CardDescription>
            </div>
            <Link href="/calendar" className="text-xs text-sage-600 hover:text-sage-700">
              ליומן המלא ←
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {todaySessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 mx-auto text-ink-subtle mb-3" strokeWidth={1.5} />
                <p className="text-ink-muted">אין פגישות ביומן היום</p>
                <Link
                  href="/calendar"
                  className="text-sm text-sage-600 hover:text-sage-700 mt-2 inline-block"
                >
                  קביעת פגישה
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-cream-200">
                {todaySessions.map((s) => {
                  const inProgress = isInProgress(s);
                  const started = s.startsAt.getTime() <= nowMs;
                  const documented = !!s.note;
                  const paymentDone = !!s.paymentStatus || !!s.invoiceItem;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center justify-between px-5 py-4 ${
                        inProgress ? "bg-sage-50" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">
                            {s.client.firstName} {s.client.lastName}
                          </span>
                          {inProgress && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-300 bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-sage-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-sage-600 animate-pulse" />
                              מתקיימת עכשיו
                            </span>
                          )}
                          {!inProgress && s.id === nextSessionId && (
                            <span className="rounded-full border border-cream-300 bg-cream-100 px-2 py-0.5 text-[11px] text-ink-muted">
                              הפגישה הבאה
                            </span>
                          )}
                          {isOver(s) && (
                            <span className="rounded-full border border-cream-300 bg-cream-100 px-2 py-0.5 text-[11px] text-ink-muted">
                              הסתיימה
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {formatDateTime(s.startsAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Bold status: green = done, terracotta = missing (past meetings only) */}
                        <Link
                          href={`/sessions/${s.id}`}
                          title={documented ? "הפגישה תועדה" : "חסר תיעוד"}
                          aria-label={documented ? "הפגישה תועדה" : "חסר תיעוד"}
                          className={`w-8 h-8 grid place-items-center rounded-lg border transition-colors ${
                            !started
                              ? "border-cream-300 bg-white/70 text-ink-muted hover:text-sage-700 hover:border-sage-300"
                              : documented
                                ? "border-sage-600 bg-sage-600 text-cream-50 shadow-glow"
                                : "border-terracotta-500/50 bg-terracotta-500/10 text-terracotta-600 font-bold"
                          }`}
                        >
                          <NotebookPen className="w-4 h-4" strokeWidth={started && !documented ? 2.5 : 2} />
                        </Link>
                        <Link
                          href={
                            s.invoiceItem
                              ? `/invoices/${s.invoiceItem.invoiceId}`
                              : `/sessions/${s.id}#billing`
                          }
                          title={paymentDone ? "התשלום עודכן" : "חסר עדכון תשלום"}
                          aria-label={paymentDone ? "התשלום עודכן" : "חסר עדכון תשלום"}
                          className={`w-8 h-8 grid place-items-center rounded-lg border transition-colors ${
                            !started
                              ? "border-cream-300 bg-white/70 text-ink-muted hover:text-sage-700 hover:border-sage-300"
                              : paymentDone
                                ? "border-sage-600 bg-sage-600 text-cream-50 shadow-glow"
                                : "border-terracotta-500/50 bg-terracotta-500/10 text-terracotta-600 font-bold"
                          }`}
                        >
                          <Receipt className="w-4 h-4" strokeWidth={started && !paymentDone ? 2.5 : 2} />
                        </Link>
                        <Link
                          href={`/sessions/${s.id}`}
                          className="text-xs text-sage-600 hover:text-sage-700 ms-1 hidden sm:inline"
                        >
                          פרטים ←
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
        <TodoCard todos={todos} />
        <Card>
          <CardHeader>
            <CardTitle>פעולות מהירות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/clients/new"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-cream-100 transition-colors text-ink-soft"
            >
              <UserPlus className="w-4 h-4 text-sage-600" />
              <span className="text-sm">הוספת לקוח</span>
            </Link>
            <Link
              href="/calendar"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-cream-100 transition-colors text-ink-soft"
            >
              <Calendar className="w-4 h-4 text-sage-600" />
              <span className="text-sm">קביעת פגישה</span>
            </Link>
            <Link
              href="/invoices"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-cream-100 transition-colors text-ink-soft"
            >
              <FileText className="w-4 h-4 text-sage-600" />
              <span className="text-sm">חשבונית חדשה</span>
            </Link>
            <Link
              href="/import"
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-cream-100 transition-colors text-ink-soft"
            >
              <ClipboardPaste className="w-4 h-4 text-sage-600" />
              <span className="text-sm">ייבוא פגישה מהודעה</span>
            </Link>
          </CardContent>
        </Card>
        </div>
      </section>
    </div>
  );
}
