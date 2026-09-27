import Link from "next/link";
import { auth } from "@/auth";
import {
  loadReportData,
  periodLabel,
  type PeriodKey,
  PERIODS,
} from "@/lib/reports";
import { periodDates } from "@/lib/report-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { PeriodTabs } from "@/components/reports/period-tabs";
import { IncomeChart } from "@/components/reports/income-chart";
import { BreakdownList } from "@/components/reports/breakdown-list";
import { ExpectedVsReceivedChart } from "@/components/reports/expected-vs-received-chart";
import { IncomeExportForm } from "@/components/reports/income-export-form";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set(PERIODS.map((p) => p.key));

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;

  const params = await searchParams;
  const period: PeriodKey = VALID_KEYS.has(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : "this-month";

  const data = await loadReportData(userId, period);
  const { summary } = data;
  const exportDefaults = periodDates(period);

  const today = new Date();
  const overdue = (dueDate: Date | null) =>
    dueDate ? dueDate.getTime() < today.getTime() : false;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">פילוח ודוחות</h1>
          <p className="text-ink-muted mt-1 text-sm">
            סקירה של ההכנסות, החובות הפתוחים ופעילות הפגישות — וייצוא דוח הכנסות ל-PDF.
          </p>
        </div>
        <PeriodTabs active={period} />
      </header>

      {/* Period summary */}
      <section>
        <h2 className="font-display text-lg text-ink-soft mb-3">
          {periodLabel(period)}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="התקבל"
            value={formatCurrency(summary.received)}
            hint="תשלומים שסומנו בפגישות ובחשבוניות"
          />
          <StatCard
            label="הכנסה צפויה"
            value={formatCurrency(summary.expected)}
            hint="לפי הפגישות ביומן בתקופה"
          />
          <StatCard
            label="פגישות שהתקיימו"
            value={summary.sessionsHeld}
            hint={
              summary.sessionsCancelled > 0
                ? `ועוד ${summary.sessionsCancelled} שבוטלו / לא התקיימו`
                : "בתקופה הנבחרת"
            }
          />
          <StatCard
            label="חוב פתוח"
            value={formatCurrency(data.outstanding)}
            hint="חשבוניות שטרם שולמו במלואן"
          />
        </div>
      </section>

      {/* 12-month trend */}
      <Card>
        <CardHeader>
          <CardTitle>הכנסות ב-12 החודשים האחרונים</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeChart data={data.twelveMonths} />
        </CardContent>
      </Card>

      {/* Expected vs received */}
      <Card>
        <CardHeader>
          <CardTitle>צפוי מול התקבל</CardTitle>
          <p className="text-xs text-ink-muted mt-1">
            כמה הייתה אמורה להכניס כל חודש לפי הפגישות ביומן, וכמה התקבל בפועל.
          </p>
        </CardHeader>
        <CardContent>
          <ExpectedVsReceivedChart data={data.twelveMonths} />
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי אמצעי תשלום</CardTitle>
            <p className="text-xs text-ink-muted mt-1">{periodLabel(period)}</p>
          </CardHeader>
          <CardContent className="p-0">
            <BreakdownList
              rows={summary.byMethod.map((m) => ({
                key: m.key,
                label: m.label,
                value: m.total,
                pct: m.pct,
              }))}
              emptyText="לא התקבלו תשלומים בתקופה זו"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>לקוחות מובילים</CardTitle>
            <p className="text-xs text-ink-muted mt-1">{periodLabel(period)}</p>
          </CardHeader>
          <CardContent className="p-0">
            <BreakdownList
              rows={summary.byClient.slice(0, 10).map((c) => ({
                key: c.key,
                label: c.label,
                value: c.total,
                pct: c.pct,
                href: `/clients/${c.key}`,
              }))}
              emptyText="לא התקבלו תשלומים בתקופה זו"
            />
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle>ייצוא דוח הכנסות</CardTitle>
          <p className="text-xs text-ink-muted mt-1">
            בוחרים חודש או טווח תאריכים ומקבלים PDF עם הסיכומים, פילוח לפי לקוח/ה ורשימת
            הפגישות והתשלומים.
          </p>
        </CardHeader>
        <CardContent>
          <IncomeExportForm defaultFrom={exportDefaults.from} defaultTo={exportDefaults.to} />
        </CardContent>
      </Card>

      {/* Outstanding invoices */}
      <Card>
        <CardHeader>
          <CardTitle>חשבוניות פתוחות</CardTitle>
          <p className="text-xs text-ink-muted mt-1">
            סך החוב הפתוח: {formatCurrency(data.outstanding)}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.outstandingInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-ink-muted text-sm">אין חשבוניות פתוחות 🎉</p>
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {data.outstandingInvoices.map((inv) => {
                const isOverdue = overdue(inv.dueDate);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-cream-100/60 transition-colors"
                    >
                      <div className="font-display text-xs sm:text-sm text-ink shrink-0 w-12 sm:w-16">
                        #{String(inv.number).padStart(4, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">{inv.clientName}</div>
                        <div className="text-[10px] sm:text-xs text-ink-muted mt-0.5">
                          {inv.dueDate ? (
                            <span className={isOverdue ? "text-terracotta-600 font-medium" : ""}>
                              לתשלום עד {formatDate(inv.dueDate)}
                              {isOverdue && " · באיחור"}
                            </span>
                          ) : (
                            <span>הופקה {formatDate(inv.issueDate)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="text-sm font-medium text-ink tabular-nums">
                          {formatCurrency(inv.balance)}
                        </div>
                        {inv.paid > 0 && (
                          <div className="text-[10px] text-ink-muted mt-0.5">
                            מתוך {formatCurrency(inv.total)}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
