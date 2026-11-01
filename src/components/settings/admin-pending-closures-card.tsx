import { DoorClosed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { closureDaysLeft } from "@/lib/account-closure";
import { daysLeftText } from "@/lib/client-trash";
import { formatDate } from "@/lib/format";

export type PendingClosureRow = {
  id: string;
  name: string;
  email: string;
  closedAt: Date | null;
  purgeAfter: Date | null;
  subscriptionExempt: boolean;
};

/** Operator only: accounts their owners closed, and when each is deleted for good. Read-only. */
export function AdminPendingClosuresCard({ rows, now }: { rows: PendingClosureRow[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorClosed className="w-5 h-5 text-sage-600" />
          סגירות חשבון ממתינות
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">אין כרגע חשבונות שנסגרו.</p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {rows.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">
                    {r.name} <span dir="ltr" className="font-normal text-ink-muted">{r.email}</span>
                  </span>
                  <span className="text-terracotta-600">
                    מחיקה: {r.purgeAfter ? daysLeftText(closureDaysLeft(r.purgeAfter, now)) : "—"}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  נסגר {formatDate(r.closedAt)} · נמחק {formatDate(r.purgeAfter)}
                  {r.subscriptionExempt ? " · חשבון פטור ממנוי" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
