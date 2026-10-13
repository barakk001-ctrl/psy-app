import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SubscriptionState } from "@/lib/subscription";
import { subscriptionHeadline } from "@/lib/plans";
import { formatDate } from "@/lib/format";

/** Settings → מנוי: the status line and the way to the plans page (/subscription). */
export function SubscriptionCard({ state }: { state: SubscriptionState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-sage-600" />
          מנוי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "expired"
              ? "border-terracotta-500/40 bg-terracotta-500/10 text-terracotta-600"
              : "border-sage-100 bg-sage-50 text-sage-700"
          }`}
        >
          <b>{subscriptionHeadline(state)}</b>
          {state.activeUntil && state.status !== "expired" && (
            <> · בתוקף עד {formatDate(state.activeUntil)}</>
          )}
        </div>
        <Link href="/subscription" className="inline-block">
          <Button type="button" variant="secondary">
            <CreditCard className="w-4 h-4" />
            {state.status === "exempt" ? "צפייה במסלולים" : "מסלולים, רכישה וחידוש"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
