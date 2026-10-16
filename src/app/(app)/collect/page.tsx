import Link from "next/link";
import { Receipt, Wallet, CheckCircle2, Clock, FileText, MinusCircle } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { FollowUpFiltersBar, ShowMoreLink } from "@/components/follow-up/follow-up-filters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  COLLECT_BADGE_LABELS,
  COLLECT_STATUSES,
  DEFAULT_COLLECT_STATUS,
  PAGE_SIZE,
  attentionFirst,
  collectBadge,
  collectWhere,
  followUpHref,
  hasActiveFilters,
  parseFollowUpFilters,
  periodPhrase,
  type CollectBadge,
  type CollectStatus,
  type SearchParams,
} from "@/lib/follow-up-filters";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASE = "/collect";

const BADGE_STYLES: Record<CollectBadge, { className: string; Icon: typeof Wallet }> = {
  pending: {
    className: "bg-terracotta-500/10 border-terracotta-500/30 text-terracotta-600",
    Icon: Wallet,
  },
  unpaid: {
    className: "bg-gold-200/60 border-gold-400/60 text-ink-soft",
    Icon: Clock,
  },
  paid: { className: "bg-sage-50 border-sage-100 text-sage-700", Icon: CheckCircle2 },
  exempt: { className: "bg-cream-100 border-cream-300 text-ink-muted", Icon: MinusCircle },
  invoiced: { className: "bg-cream-100 border-cream-300 text-ink-muted", Icon: FileText },
};

const SECTION_TITLES: Record<CollectStatus, string> = {
  pending: "פגישות ללא עדכון תשלום",
  unpaid: "פגישות שטרם שולמו",
  paid: "פגישות ששולמו",
  all: "פגישות ותשלומים",
};

export default async function CollectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const filters = parseFollowUpFilters(await searchParams, COLLECT_STATUSES, DEFAULT_COLLECT_STATUS);
  const where = collectWhere(userId, filters, now);

  const [rows, total, clients, invoices] = await Promise.all([
    db.session.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: filters.limit,
      select: {
        id: true,
        startsAt: true,
        paymentStatus: true,
        client: { select: { firstName: true, lastName: true } },
        invoiceItem: { select: { id: true } },
      },
    }),
    db.session.count({ where }),
    db.client.findMany({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, status: true },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    // Open invoices are open whatever the period; the client filter applies.
    db.invoice.findMany({
      where: {
        userId,
        status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
      },
      orderBy: [{ issueDate: "asc" }],
      take: 50,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  // Meetings still waiting for a payment update first
  const sessions = attentionFirst(
    rows.map((s) => ({
      ...s,
      badge: collectBadge({ paymentStatus: s.paymentStatus, hasInvoice: !!s.invoiceItem }),
    })),
    (s) => s.badge === "pending" || s.badge === "unpaid",
  );
  const active = hasActiveFilters(filters, DEFAULT_COLLECT_STATUS);
  const selectedClient = filters.clientId ? clients.find((c) => c.id === filters.clientId) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">אישורי תשלום</h1>
        <p className="text-ink-muted mt-1 text-sm">
          פגישות {periodPhrase(filters)}
          {filters.status === "pending" && " שעוד לא עודכן להן תשלום"}, וחשבוניות עם יתרה פתוחה.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">{SECTION_TITLES[filters.status]}</h2>

        <FollowUpFiltersBar
          key={followUpHref(BASE, filters, DEFAULT_COLLECT_STATUS)}
          basePath={BASE}
          filters={filters}
          statuses={COLLECT_STATUSES}
          defaultStatus={DEFAULT_COLLECT_STATUS}
          clients={clients.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            active: c.status === "ACTIVE",
          }))}
          count={total}
        />

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-ink-muted space-y-3">
              {active ? (
                <>
                  <p>לא נמצאו פגישות שמתאימות לסינון.</p>
                  <Link href={BASE} className="inline-block text-sage-600 hover:text-sage-700">
                    נקה סינון
                  </Link>
                </>
              ) : (
                <>
                  <CheckCircle2
                    className="w-8 h-8 mx-auto text-sage-600 mb-2"
                    strokeWidth={1.5}
                  />
                  לכל הפגישות {periodPhrase(filters)} עודכן תשלום 🎉
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <ul className="divide-y divide-cream-200">
                {sessions.map((s) => {
                  const { className, Icon } = BADGE_STYLES[s.badge];
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/sessions/${s.id}#billing`}
                        className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-cream-100/60 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-ink">
                            {s.client.firstName} {s.client.lastName}
                          </div>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {formatDateTime(s.startsAt)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border shrink-0",
                            className,
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" /> {COLLECT_BADGE_LABELS[s.badge]}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
            {total > sessions.length && (
              <ShowMoreLink
                basePath={BASE}
                filters={filters}
                defaultStatus={DEFAULT_COLLECT_STATUS}
                remaining={total - sessions.length}
                step={PAGE_SIZE}
              />
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">
          חשבוניות פתוחות
          {selectedClient && (
            <span className="text-ink-muted font-normal text-base">
              {" "}
              · {selectedClient.firstName} {selectedClient.lastName}
            </span>
          )}
        </h2>
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-ink-muted space-y-3">
              <Receipt
                className="w-8 h-8 mx-auto text-ink-subtle"
                strokeWidth={1.5}
              />
              <p>{selectedClient ? "אין חשבוניות פתוחות למטופל/ת זו." : "אין חשבוניות פתוחות — הכול שולם 🎉"}</p>
              <Link
                href="/invoices/new"
                className="inline-block text-sage-600 hover:text-sage-700"
              >
                מסמך חדש (חשבונית / קבלה) ←
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-cream-200">
              {invoices.map((inv) => {
                const balance = Number(inv.total) - Number(inv.amountPaid);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-cream-100/60 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-ink">
                          {inv.client.firstName} {inv.client.lastName}
                          <span className="text-ink-muted font-normal">
                            {" "}
                            · #{String(inv.number).padStart(4, "0")}
                          </span>
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                          {formatDate(inv.issueDate)}
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-display text-lg text-ink">
                          {formatCurrency(balance)}
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          יתרה לתשלום
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
