import Link from "next/link";
import { NotebookPen, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function DocumentPage() {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const sessions = await db.session.findMany({
    where: {
      userId,
      status: { in: ["SCHEDULED", "COMPLETED"] },
      startsAt: {
        gte: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
        lte: now,
      },
    },
    orderBy: { startsAt: "desc" },
    take: 40,
    include: {
      client: { select: { firstName: true, lastName: true } },
      note: { select: { id: true } },
    },
  });

  const missing = sessions.filter((s) => !s.note);
  const documented = sessions.filter((s) => !!s.note);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">תיעוד פגישות</h1>
        <p className="text-ink-muted mt-1 text-sm">
          פגישות משלושת השבועות האחרונים — בחרו פגישה כדי לכתוב או להשלים סיכום.
        </p>
      </header>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-ink-muted">
            לא התקיימו פגישות בשלושת השבועות האחרונים.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-cream-200">
            {[...missing, ...documented].map((s) => (
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
      )}
    </div>
  );
}
