import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadAllPeriodsReport } from "@/lib/reports";
import {
  CUSTOM_PERIOD,
  DEFAULT_PERIOD,
  isWholeMonth,
  parseDateRange,
  parsePeriodParam,
  periodHref,
  type PeriodChoice,
  type PeriodKey,
} from "@/lib/report-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { PeriodPanel, PeriodPicker, PeriodProvider } from "@/components/reports/period-switch";
import { IncomeChart } from "@/components/reports/income-chart";
import { BreakdownList } from "@/components/reports/breakdown-list";
import { ExpectedVsReceivedChart } from "@/components/reports/expected-vs-received-chart";
import { IncomeExportForm } from "@/components/reports/income-export-form";
import { formatCurrency, formatDate } from "@/lib/format";
import { documentsEnabled } from "@/lib/features";
import { MaybeLink } from "@/components/ui/maybe-link";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export const metadata = { title: "פילוח ודוחות — מרפאה אישית" };

// The two charts keep their own window whatever the picker says
const ALWAYS_12_MONTHS = "תמיד 12 החודשים האחרונים, בלי קשר לתקופה שנבחרה.";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session!.user.id;

  // One clock for the whole page: the picker's labels ("שנה נוכחית (2026)")
  // and the numbers under them are cut by the same moment, in Israel time
  const now = new Date();
  const params = await searchParams;
  const custom = parseDateRange(one(params.from), one(params.to));
  const asked = parsePeriodParam(one(params.period), now);
  // The old "רבעון" tab: on to the quarter it meant
  if (!custom && asked && asked !== one(params.period)) redirect(periodHref(asked));
  const active: PeriodChoice = custom ? CUSTOM_PERIOD : (asked ?? DEFAULT_PERIOD);

  const data = await loadAllPeriodsReport(
    userId,
    now,
    custom ? { from: custom.from, to: custom.to } : null,
  );
  // Each period with its numbers; the labels and ranges come with the data
  const periods = data.periodList.flatMap((p) => {
    const summary = p.key === CUSTOM_PERIOD ? data.custom : data.periods[p.key];
    return summary ? [{ ...p, summary }] : [];
  });
  const fixed = periods.flatMap((p) =>
    p.key === CUSTOM_PERIOD ? [] : [{ key: p.key as PeriodKey, label: p.label, from: p.from, to: p.to }],
  );
  // Document pages are hidden until they can be issued: the rows stay, without links
  const documents = documentsEnabled();

  const overdue = (dueDate: Date | null) =>
    dueDate ? dueDate.getTime() < now.getTime() : false;

  return (
    <PeriodProvider
      active={active}
      keys={periods.map((p) => p.key)}
      stamp={custom ? `${active}:${custom.from}:${custom.to}` : active}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">פילוח ודוחות</h1>
          <p className="text-ink-muted mt-1 text-sm">
            סקירה של ההכנסות, החובות הפתוחים ופעילות הפגישות — וייצוא דוח הכנסות ל-PDF.
          </p>
        </div>
        <PeriodPicker
          periods={fixed}
          custom={custom ? { from: custom.from, to: custom.to } : null}
        />
      </header>

      {/* Period summary */}
      {periods.map((p) => (
        <PeriodPanel key={p.key} period={p.key}>
          <section>
            <h2 className="font-display text-lg text-ink-soft mb-3">{p.heading}</h2>
            {p.notStarted && (
              <p className="text-xs text-ink-muted -mt-2 mb-3">
                התקופה עוד לא התחילה: מוצג מה שכבר נקבע ביומן.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="התקבל"
                value={formatCurrency(p.summary.received)}
                hint="תשלומים שסומנו בפגישות ובחשבוניות"
              />
              <StatCard
                label="הכנסה צפויה"
                value={formatCurrency(p.summary.expected)}
                hint="לפי הפגישות ביומן בתקופה"
              />
              <StatCard
                label="פגישות שהתקיימו"
                value={p.summary.sessionsHeld}
                hint={
                  p.summary.sessionsCancelled > 0
                    ? `ועוד ${p.summary.sessionsCancelled} שבוטלו / לא התקיימו`
                    : "בתקופה הנבחרת"
                }
              />
              <StatCard
                label="חוב פתוח"
                value={formatCurrency(data.outstanding)}
                hint="נכון להיום · לא תלוי בתקופה"
              />
            </div>
          </section>
        </PeriodPanel>
      ))}

      {/* 12-month trend */}
      <Card>
        <CardHeader>
          <CardTitle>הכנסות ב-12 החודשים האחרונים</CardTitle>
          <p className="text-xs text-ink-muted mt-1">{ALWAYS_12_MONTHS}</p>
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
            כמה היה צפוי להיכנס כל חודש לפי הפגישות ביומן, וכמה התקבל בפועל. {ALWAYS_12_MONTHS}
          </p>
        </CardHeader>
        <CardContent>
          <ExpectedVsReceivedChart data={data.twelveMonths} />
        </CardContent>
      </Card>

      {/* Breakdowns */}
      {periods.map((p) => (
        <PeriodPanel key={p.key} period={p.key}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>פילוח לפי אמצעי תשלום</CardTitle>
                <p className="text-xs text-ink-muted mt-1">{p.heading}</p>
              </CardHeader>
              <CardContent className="p-0">
                <BreakdownList
                  rows={p.summary.byMethod.map((m) => ({
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
                <p className="text-xs text-ink-muted mt-1">{p.heading}</p>
              </CardHeader>
              <CardContent className="p-0">
                <BreakdownList
                  rows={p.summary.byClient.slice(0, 10).map((c) => ({
                    key: c.key,
                    label: c.label,
                    value: c.total,
                    pct: c.pct,
                    // A one-off client has no card to open
                    href: c.key.startsWith("one-off:") ? undefined : `/clients/${c.key}`,
                  }))}
                  emptyText="לא התקבלו תשלומים בתקופה זו"
                />
              </CardContent>
            </Card>
          </div>
        </PeriodPanel>
      ))}

      {/* Export */}
      {periods.map((p) => (
        <PeriodPanel key={p.key} period={p.key}>
          <Card>
            <CardHeader>
              <CardTitle>ייצוא דוח הכנסות</CardTitle>
              <p className="text-xs text-ink-muted mt-1">
                בוחרים חודש או טווח תאריכים ומקבלים PDF עם הסיכומים, פילוח לפי לקוח/ה ורשימת
                הפגישות והתשלומים.
              </p>
            </CardHeader>
            <CardContent>
              <IncomeExportForm
                key={`${p.from}:${p.to}`}
                defaultFrom={p.from}
                defaultTo={p.to}
                defaultMode={isWholeMonth(p.from, p.to) ? "month" : "range"}
              />
            </CardContent>
          </Card>
        </PeriodPanel>
      ))}

      {/* Outstanding invoices */}
      <Card>
        <CardHeader>
          <CardTitle>חשבוניות פתוחות</CardTitle>
          <p className="text-xs text-ink-muted mt-1">
            סך החוב הפתוח: {formatCurrency(data.outstanding)} · נכון להיום, לא תלוי בתקופה
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
                    <MaybeLink
                      href={documents ? `/invoices/${inv.id}` : null}
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
                    </MaybeLink>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </PeriodProvider>
  );
}
