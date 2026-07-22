import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { Calendar, UserPlus, FileText } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [activeClients, upcomingSessions, monthPayments, outstanding] = await Promise.all([
    db.client.count({ where: { userId, status: "ACTIVE" } }),
    db.session.findMany({
      // endsAt ≥ now so a meeting that's happening right now stays in the list
      where: { userId, endsAt: { gte: now }, status: "SCHEDULED" },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { client: { select: { firstName: true, lastName: true } } },
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
  ]);

  const monthIncome = Number(monthPayments._sum.amount ?? 0);
  const outstandingAmount =
    Number(outstanding._sum.total ?? 0) - Number(outstanding._sum.amountPaid ?? 0);

  const nowMs = now.getTime();
  const isInProgress = (s: { startsAt: Date; endsAt: Date }) =>
    s.startsAt.getTime() <= nowMs && s.endsAt.getTime() >= nowMs;
  const nextSessionId = upcomingSessions.find((s) => !isInProgress(s))?.id;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">
            {new Intl.DateTimeFormat("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Jerusalem",
            }).format(now)}
          </p>
          <h1 className="font-display text-4xl text-ink mt-1">
            שלום, {session!.user.name?.split(" ")[0]}
          </h1>
        </div>
        <div className="flex gap-2">
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
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="לקוחות פעילים" value={activeClients} />
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
        <StatCard label="פגישות קרובות" value={upcomingSessions.length} hint="ב-5 הפגישות הבאות" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>הפגישות הקרובות</CardTitle>
              <CardDescription>5 הפגישות הבאות ביומן</CardDescription>
            </div>
            <Link href="/calendar" className="text-xs text-sage-600 hover:text-sage-700">
              ליומן המלא ←
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 mx-auto text-ink-subtle mb-3" strokeWidth={1.5} />
                <p className="text-ink-muted">אין פגישות מתוכננות</p>
                <Link
                  href="/calendar"
                  className="text-sm text-sage-600 hover:text-sage-700 mt-2 inline-block"
                >
                  קביעת פגישה ראשונה
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-cream-200">
                {upcomingSessions.map((s) => {
                  const inProgress = isInProgress(s);
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
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {formatDateTime(s.startsAt)}
                        </div>
                      </div>
                      <Link
                        href={`/sessions/${s.id}`}
                        className="text-xs text-sage-600 hover:text-sage-700"
                      >
                        פרטים ←
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
