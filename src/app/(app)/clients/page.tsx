import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Users, UserPlus, Phone, Mail } from "lucide-react";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.view === "archived";

  const session = await auth();
  const userId = session!.user.id;

  const [clients, archivedCount] = await Promise.all([
    db.client.findMany({
      where: { userId, status: showArchived ? "ARCHIVED" : { not: "ARCHIVED" } },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      include: { _count: { select: { sessions: true } } },
    }),
    db.client.count({ where: { userId, status: "ARCHIVED" } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">לקוחות</h1>
          <p className="text-ink-muted mt-1 text-sm">
            {showArchived
              ? `${clients.length} לקוחות מאוחסנים`
              : `${clients.length} לקוחות פעילים`}
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <UserPlus className="w-4 h-4" /> לקוח חדש
          </Button>
        </Link>
      </header>

      {/* View toggle */}
      {(archivedCount > 0 || showArchived) && (
        <div className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1">
          <Link
            href="/clients"
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              !showArchived
                ? "bg-white text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            פעילים
          </Link>
          <Link
            href="/clients?view=archived"
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              showArchived
                ? "bg-white text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            מאוחסנים ({archivedCount})
          </Link>
        </div>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-ink-subtle mb-4" strokeWidth={1.25} />
            <h3 className="font-display text-xl text-ink">
              {showArchived ? "אין לקוחות מאוחסנים" : "עדיין אין לקוחות"}
            </h3>
            {!showArchived && (
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
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-cream-100/60 transition-colors"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-display text-base shrink-0",
                      c.status === "ARCHIVED"
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
                          c.status === "ARCHIVED" ? "text-ink-muted" : "text-ink",
                        )}
                      >
                        {c.firstName} {c.lastName}
                      </span>
                      {c.status === "INACTIVE" && (
                        <span className="text-[10px] uppercase tracking-wider bg-cream-200 text-ink-muted px-1.5 py-0.5 rounded">
                          לא פעיל
                        </span>
                      )}
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
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
