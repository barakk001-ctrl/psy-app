import Link from "next/link";
import { CreditCard } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { PlanCards } from "@/components/plans/plan-cards";
import { PlanRequestButton } from "@/components/plans/plan-request-button";
import { subscriptionStateFor } from "@/lib/subscription-server";
import { subscriptionHeadline, trialDaysLeftText } from "@/lib/plans";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { billingConfigured } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { startCardPaymentAction } from "@/server/actions/subscription";

/**
 * "מנוי ומסלולים": where a therapist sees her plan, what each plan includes
 * and buys or renews. Card payment (Grow) when configured; otherwise a
 * request to the operator, who replies with payment details.
 */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; payerr?: string; readonly?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const state = await subscriptionStateFor(session!.user.id);
  const cardPayments = billingConfigured();
  const canBuy = state.status !== "exempt";
  const renewing = state.status === "active";

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">מנוי ומסלולים</h1>
        <p className="text-ink-muted text-sm mt-1">
          המסלולים, מה כל אחד כולל, ורכישה או חידוש של המנוי.
        </p>
      </header>

      {sp.readonly === "1" && state.status === "expired" && (
        // A blocked action (central write lock) lands here
        <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600">
          {READ_ONLY_ERROR}
        </div>
      )}
      {sp.paid === "1" && (
        <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
          התשלום התקבל — תודה! המנוי יתעדכן כאן תוך דקות ספורות.
        </div>
      )}
      {sp.paid === "0" && (
        <div className="rounded-xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft">
          התשלום בוטל — אפשר לנסות שוב בכל עת.
        </div>
      )}
      {sp.payerr && (
        <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600">
          {sp.payerr}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border px-5 py-4",
          state.status === "expired"
            ? "border-terracotta-500/40 bg-terracotta-500/10"
            : "border-sage-100 bg-sage-50",
        )}
      >
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <CreditCard className="w-4 h-4" /> המנוי שלך
        </div>
        <p
          className={cn(
            "font-display text-xl mt-1",
            state.status === "expired" ? "text-terracotta-600" : "text-ink",
          )}
        >
          {subscriptionHeadline(state)}
        </p>
        {state.activeUntil && state.status !== "expired" && (
          <p className="text-sm text-ink-soft mt-0.5">בתוקף עד {formatDate(state.activeUntil)}</p>
        )}
        {state.status === "expired" && (
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">
            כל המידע שמור וזמין לצפייה ולייצוא. אחרי החידוש אפשר להמשיך לעבוד כרגיל.
          </p>
        )}
      </div>

      <PlanCards
        currentPlan={state.status === "active" ? state.plan : null}
        // The trial card only while the account is in it; after the trial
        // (paid, expired) or for exempt accounts it is not a choice, so it's left out.
        trial={
          state.status === "trial"
            ? { current: true, status: trialDaysLeftText(state.daysLeft) }
            : null
        }
        renderAction={
          canBuy
            ? (p) =>
                cardPayments ? (
                  <form action={startCardPaymentAction}>
                    <input type="hidden" name="plan" value={p.id} />
                    <Button
                      type="submit"
                      className="w-full"
                      variant={p.highlight ? "primary" : "secondary"}
                    >
                      <CreditCard className="w-4 h-4" />
                      {renewing ? "חידוש" : "רכישה"} — ₪{p.price}
                    </Button>
                  </form>
                ) : (
                  <PlanRequestButton
                    planId={p.id}
                    primary={p.highlight}
                    label={`${renewing ? "בקשה לחידוש" : "בקשה לרכישה"} — ₪${p.price}`}
                  />
                )
            : undefined
        }
      />

      {canBuy && (
        <p className="text-xs text-ink-muted leading-relaxed">
          {cardPayments
            ? "תשלום מאובטח בכרטיס אשראי או ביט (Grow). המנוי מתעדכן אוטומטית עם אישור התשלום, ועל כל תשלום נשלחת קבלה."
            : "התשלום כרגע בהעברה בנקאית או בביט: אחרי שליחת הבקשה נחזור אלייך עם הפרטים, והמנוי יופעל בחשבון מיד כשהתשלום יתקבל. על כל תשלום נשלחת קבלה."}{" "}
          חידוש לפני סוף התקופה מוסיף את התקופה החדשה אחרי זו שכבר שולמה.
        </p>
      )}

      <p className="text-xs text-ink-subtle">
        פרטים מלאים ב
        <Link href="/terms" className="underline underline-offset-2">
          תנאי השימוש
        </Link>{" "}
        (סעיפים 4–7). הקישור לעמוד המחירים הציבורי:{" "}
        <Link href="/pricing" className="underline underline-offset-2">
          מסלולים ומחירים
        </Link>
        .
      </p>
    </div>
  );
}
