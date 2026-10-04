import Link from "next/link";
import { auth } from "@/auth";
import { db, dbAll } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Users, UserPlus, Phone, Mail } from "lucide-react";
import { ClientStatusMoveButton } from "@/components/clients/client-status-toggle";
import { DeleteClientButton, TrashRowActions } from "@/components/clients/client-trash";
import { TRASH_DAYS, daysLeftText, trashDaysLeft } from "@/lib/client-trash";
import { purgeExpiredClients } from "@/lib/client-trash-data";
import { formatDate } from "@/lib/format";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  // "archived" is the old name of the inactive tab — keep old links working
  const view =
    params.view === "trash"
      ? "TRASH"
      : params.view === "inactive" || params.view === "archived"
        ? "INACTIVE"
        : "ACTIVE";

  const session = await auth();
  const userId = session!.user.id;

  // The bin never shows a client whose 30 days are over, even if the hourly
  // purge hasn't reached it yet
  const now = new Date();
  if (view === "TRASH") await purgeExpiredClients(now, userId);

  // `db` leaves clients in the recycle bin out; the bin itself reads `dbAll`
  const [clients, activeCount, inactiveCount, trashCount] = await Promise.all([
    view === "TRASH"
      ? Promise.resolve([])
      : db.client.findMany({
          where: { userId, status: view },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: { _count: { select: { sessions: true } } },
        }),
    db.client.count({ where: { userId, status: "ACTIVE" } }),
    db.client.count({ where: { userId, status: "INACTIVE" } }),
    dbAll.client.count({ where: { userId, deletedAt: { not: null } } }),
  ]);
  const trashed =
    view === "TRASH"
      ? await dbAll.client.findMany({
          where: { userId, deletedAt: { not: null } },
          orderBy: { deletedAt: "desc" },
          select: { id: true, firstName: true, lastName: true, deletedAt: true },
        })
      : [];

  const VIEWS = [
    { key: "ACTIVE", href: "/clients", label: `פעילים (${activeCount})` },
    { key: "INACTIVE", href: "/clients?view=inactive", label: `לא פעילים (${inactiveCount})` },
    ...(trashCount > 0 || view === "TRASH"
      ? [{ key: "TRASH", href: "/clients?view=trash", label: `סל מחזור (${trashCount})` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">לקוחות</h1>
          <p className="text-ink-muted mt-1 text-sm">
            כל התיקים שלך. לקוחות שסיימו או בהפסקה עוברים ל״לא פעילים״ — ההיסטוריה
            נשמרת במלואה, ואפשר להחזיר אותם בלחיצה.
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <UserPlus className="w-4 h-4" /> לקוח חדש
          </Button>
        </Link>
      </header>

      {/* View filter */}
      {activeCount + inactiveCount + trashCount > 0 && (
        <div className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1 flex-wrap">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.href}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-white text-ink shadow-soft"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>
      )}

      {view === "TRASH" ? (
        <Card>
          <p className="px-5 pt-4 pb-3 text-sm text-ink-muted leading-relaxed border-b border-cream-200">
            תיקים שנמחקו נשמרים כאן {TRASH_DAYS} יום — מוסתרים מכל מקום ובלי תזכורות — ואז
            נמחקים לצמיתות עם כל הפגישות, הסיכומים והקבצים שלהם. שחזור מחזיר את התיק בדיוק
            כפי שהיה, כלא פעיל.
          </p>
          {trashed.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-subtle">סל המחזור ריק.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {trashed.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center">
                  <div className="flex-1 min-w-0 flex items-center gap-4 ps-5 pe-2 py-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-base shrink-0 bg-cream-200 text-ink-subtle">
                      {c.firstName[0]}
                      {c.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink-muted">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-xs text-ink-subtle mt-1">
                        נמחק/ה ב-{formatDate(c.deletedAt!)} · מחיקה לצמיתות{" "}
                        {daysLeftText(trashDaysLeft(c.deletedAt!, now))}
                      </div>
                    </div>
                  </div>
                  <TrashRowActions clientId={c.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
            <h3 className="font-display text-xl text-ink">
              {view === "INACTIVE" && "אין לקוחות לא פעילים"}
              {view === "ACTIVE" && "עדיין אין לקוחות"}
            </h3>
            {view === "ACTIVE" && (
              <>
                <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto">
                  הוספת לקוחות תאפשר לך לקבוע עבורם פגישות, לכתוב סיכומים ולהפיק חשבוניות.
                </p>
                <Link href="/clients/new" className="inline-block mt-5">
                  <Button>
                    <UserPlus className="w-4 h-4" /> הוספת לקוח ראשון
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-cream-200">
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center hover:bg-cream-100/60 transition-colors"
              >
                <Link
                  href={`/clients/${c.id}`}
                  className="flex-1 min-w-0 flex items-center gap-4 ps-5 pe-2 py-4"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-display text-base shrink-0",
                      c.status === "INACTIVE"
                        ? "bg-cream-200 text-ink-muted"
                        : "bg-sage-100 text-sage-700",
                    )}
                  >
                    {c.firstName[0]}
                    {c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          c.status === "INACTIVE" ? "text-ink-muted" : "text-ink",
                        )}
                      >
                        {c.firstName} {c.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-ink-muted mt-1">
                      {c.phone && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left text-xs text-ink-muted shrink-0 hidden sm:block">
                    <div>{c._count.sessions} פגישות</div>
                    {c.defaultRate && (
                      <div className="mt-0.5">{formatCurrency(c.defaultRate.toString())}</div>
                    )}
                  </div>
                </Link>
                <ClientStatusMoveButton clientId={c.id} status={c.status} />
                {c.status === "INACTIVE" && <DeleteClientButton clientId={c.id} variant="row" />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
