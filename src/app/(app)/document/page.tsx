import Link from "next/link";
import { NotebookPen, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { FollowUpFiltersBar, ShowMoreLink } from "@/components/follow-up/follow-up-filters";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_DOCUMENT_STATUS,
  DOCUMENT_STATUSES,
  PAGE_SIZE,
  attentionFirst,
  documentWhere,
  followUpHref,
  hasActiveFilters,
  parseFollowUpFilters,
  periodPhrase,
  type SearchParams,
} from "@/lib/follow-up-filters";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASE = "/document";

export default async function DocumentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const filters = parseFollowUpFilters(await searchParams, DOCUMENT_STATUSES, DEFAULT_DOCUMENT_STATUS);
  const where = documentWhere(userId, filters, now);

  const [rows, total, clients] = await Promise.all([
    db.session.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: filters.limit,
      include: {
        client: { select: { firstName: true, lastName: true } },
        note: { select: { id: true } },
      },
    }),
    db.session.count({ where }),
    db.client.findMany({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, status: true },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // Meetings still missing a summary first, then the documented ones
  const sessions = attentionFirst(rows, (s) => !s.note);
  const active = hasActiveFilters(filters, DEFAULT_DOCUMENT_STATUS);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">תיעוד פגישות</h1>
        <p className="text-ink-muted mt-1 text-sm">
          פגישות {periodPhrase(filters)} — בחרו פגישה כדי לכתוב או להשלים סיכום.
        </p>
      </header>

      <FollowUpFiltersBar
        key={followUpHref(BASE, filters, DEFAULT_DOCUMENT_STATUS)}
        basePath={BASE}
        filters={filters}
        statuses={DOCUMENT_STATUSES}
        defaultStatus={DEFAULT_DOCUMENT_STATUS}
        clients={clients.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          active: c.status === "ACTIVE",
        }))}
        count={total}
      />

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-ink-muted space-y-3">
            <p>
              {active
                ? "לא נמצאו פגישות שמתאימות לסינון."
                : `לא התקיימו פגישות ${periodPhrase(filters)}.`}
            </p>
            {active && (
              <Link href={BASE} className="inline-block text-sage-600 hover:text-sage-700">
                נקה סינון
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-cream-200">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
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
                        s.note
                          ? "bg-sage-50 border-sage-100 text-sage-700"
                          : "bg-terracotta-500/10 border-terracotta-500/30 text-terracotta-600",
                      )}
                    >
                      {s.note ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> מתועדת
                        </>
                      ) : (
                        <>
                          <NotebookPen className="w-3.5 h-3.5" /> חסר תיעוד
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {total > sessions.length && (
            <ShowMoreLink
              basePath={BASE}
              filters={filters}
              defaultStatus={DEFAULT_DOCUMENT_STATUS}
              remaining={total - sessions.length}
              step={PAGE_SIZE}
            />
          )}
        </>
      )}
    </div>
  );
}
