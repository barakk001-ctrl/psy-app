import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRICING, type SubscriptionState } from "@/lib/subscription";
import { formatDate } from "@/lib/format";
import { startCardPaymentAction } from "@/server/actions/subscription";

const STATUS_LABEL: Record<SubscriptionState["status"], string> = {
  exempt: "חשבון מנהל/ת — ללא צורך במנוי",
  trial: "תקופת ניסיון",
  active: "מנוי פעיל",
  expired: "המנוי הסתיים — מצב קריאה בלבד",
};

export function SubscriptionCard({
  state,
  cardPayments = false,
  notice = null,
}: {
  state: SubscriptionState;
  /** true once the Grow account is configured — shows the pay buttons */
  cardPayments?: boolean;
  notice?: "paid" | "cancelled" | string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-sage-600" />
          מנוי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice === "paid" && (
          <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
            התשלום התקבל — תודה! המנוי יתעדכן כאן תוך דקות ספורות.
          </div>
        )}
        {notice === "cancelled" && (
          <div className="rounded-xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft">
            התשלום בוטל — אפשר לנסות שוב בכל עת.
          </div>
        )}
        {notice && notice !== "paid" && notice !== "cancelled" && (
          <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600">
            {notice}
          </div>
        )}
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "expired"
              ? "border-terracotta-500/40 bg-terracotta-500/10 text-terracotta-600"
              : "border-sage-100 bg-sage-50 text-sage-700"
          }`}
        >
          <b>{STATUS_LABEL[state.status]}</b>
          {state.activeUntil && state.status !== "expired" && (
            <> · בתוקף עד {formatDate(state.activeUntil)}</>
          )}
          {state.status === "trial" && state.daysLeft !== null && (
            <> ({state.daysLeft} ימים נותרו)</>
          )}
        </div>

        {state.status !== "exempt" && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-cream-300 bg-white/60 px-4 py-3">
                <div className="text-sm font-semibold text-ink">מנוי חודשי</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl text-ink">
                    ₪{PRICING.monthlyIntro}
                  </span>
                  <span className="text-sm text-ink-subtle line-through">
                    ₪{PRICING.monthlyRegular}
                  </span>
                  <span className="text-xs text-sage-600 font-medium">מחיר היכרות</span>
                </div>
                <div className="text-xs text-ink-muted mt-0.5">לחודש</div>
              </div>
              <div className="rounded-xl border border-sage-300 bg-sage-50/60 px-4 py-3">
                <div className="text-sm font-semibold text-ink">
                  מנוי שנתי <span className="text-xs text-sage-600">(חודשיים מתנה)</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl text-ink">
                    ₪{PRICING.yearlyIntro}
                  </span>
                  <span className="text-sm text-ink-subtle line-through">
                    ₪{PRICING.yearlyRegular}
                  </span>
                  <span className="text-xs text-sage-600 font-medium">מחיר היכרות</span>
                </div>
                <div className="text-xs text-ink-muted mt-0.5">לשנה</div>
              </div>
            </div>
            {cardPayments ? (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <form action={startCardPaymentAction}>
                    <input type="hidden" name="plan" value="MONTHLY" />
                    <Button type="submit" variant="secondary" className="w-full">
                      <CreditCard className="w-4 h-4" />
                      תשלום חודשי — ₪{PRICING.monthlyIntro}
                    </Button>
                  </form>
                  <form action={startCardPaymentAction}>
                    <input type="hidden" name="plan" value="YEARLY" />
                    <Button type="submit" className="w-full">
                      <CreditCard className="w-4 h-4" />
                      תשלום שנתי — ₪{PRICING.yearlyIntro}
                    </Button>
                  </form>
                </div>
                <p className="text-xs text-ink-subtle">
                  תשלום מאובטח בכרטיס אשראי או ביט (Grow) — המנוי מתעדכן
                  אוטומטית עם אישור התשלום. אפשר גם בהעברה/ביט ישירות למנהלת
                  המערכת.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-muted leading-relaxed">
                לרכישה או חידוש פנו למנהלת המערכת — התשלום בהעברה/ביט, וקבלה
                נשלחת אליכם. המנוי מופעל בחשבון מיד עם קבלת התשלום.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
