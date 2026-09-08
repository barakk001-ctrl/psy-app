import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getSubscriptionState, type SubscriptionFields } from "@/lib/subscription";
import {
  extendSubscriptionAction,
  toggleSubscriptionExemptAction,
} from "@/server/actions/subscription";

export type AdminUserRow = SubscriptionFields & {
  id: string;
  name: string;
  email: string;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  exempt: { label: "פטור/ה", cls: "bg-cream-200 text-ink-muted" },
  trial: { label: "ניסיון", cls: "bg-sage-100 text-sage-700" },
  active: { label: "פעיל", cls: "bg-sage-600 text-cream-50" },
  expired: { label: "הסתיים", cls: "bg-terracotta-500/15 text-terracotta-600" },
};

/** Operator-only: everyone's subscription at a glance + manual extensions
 *  after a payment lands (Bit/transfer + morning receipt). */
export function AdminSubscriptionsCard({
  users,
  meId,
}: {
  users: AdminUserRow[];
  meId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-sage-600" />
          ניהול מנויים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm text-ink-muted leading-relaxed mb-3">
          התקבל תשלום? מאריכים כאן בלחיצה. ההארכה נספרת מסוף התקופה הנוכחית.
        </p>
        <ul className="divide-y divide-cream-200">
          {users.map((u) => {
            const st = getSubscriptionState(u);
            const badge = STATUS_BADGE[st.status];
            return (
              <li key={u.id} className="py-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-44">
                  <div className="text-sm font-medium text-ink">
                    {u.name}
                    {u.id === meId && (
                      <span className="text-xs text-ink-subtle"> (את/ה)</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted" dir="ltr">
                    {u.email}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                  {badge.label}
                  {st.activeUntil && st.status !== "exempt" && (
                    <> · עד {formatDate(st.activeUntil)}</>
                  )}
                </span>
                {!u.subscriptionExempt && !u.isAdmin && (
                  <span className="flex items-center gap-1">
                    <form action={extendSubscriptionAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="plan" value="MONTHLY" />
                      <Button type="submit" size="sm" variant="secondary">
                        +חודש
                      </Button>
                    </form>
                    <form action={extendSubscriptionAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="plan" value="YEARLY" />
                      <Button type="submit" size="sm" variant="secondary">
                        +שנה
                      </Button>
                    </form>
                  </span>
                )}
                {u.id !== meId && !u.isAdmin && (
                  <form action={toggleSubscriptionExemptAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="text-xs text-ink-muted hover:text-ink px-1.5"
                      title="פטור ממנוי (למשל חשבון מתנה)"
                    >
                      {u.subscriptionExempt ? "ביטול פטור" : "פטור"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
