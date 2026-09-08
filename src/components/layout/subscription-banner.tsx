import Link from "next/link";
import { Lock, Hourglass } from "lucide-react";

/** Shown on every page: read-only notice when expired, countdown when the
 *  trial is in its final week. */
export function SubscriptionBanner({
  status,
  daysLeft,
}: {
  status: "trial" | "expired";
  daysLeft: number | null;
}) {
  if (status === "expired") {
    return (
      <div className="rounded-2xl border border-terracotta-500/40 bg-terracotta-500/10 px-5 py-4 mb-5 flex flex-wrap items-center gap-3">
        <Lock className="w-5 h-5 text-terracotta-600 shrink-0" />
        <p className="flex-1 min-w-56 text-sm text-ink-soft leading-relaxed">
          <b>המנוי הסתיים והמערכת במצב קריאה בלבד.</b> כל הנתונים שמורים
          וזמינים לצפייה ולייצוא. לחידוש —{" "}
          <Link href="/settings" className="text-terracotta-600 font-medium underline underline-offset-2">
            פרטי המנוי בהגדרות
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-cream-300 bg-cream-100 px-5 py-3 mb-5 flex items-center gap-3">
      <Hourglass className="w-4 h-4 text-ink-muted shrink-0" />
      <p className="flex-1 text-sm text-ink-soft">
        נותרו <b>{daysLeft}</b> ימי ניסיון.{" "}
        <Link href="/settings" className="text-sage-600 font-medium">
          לפרטי המנוי ←
        </Link>
      </p>
    </div>
  );
}
