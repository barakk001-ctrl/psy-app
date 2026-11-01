import Link from "next/link";
import { auth } from "@/auth";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";
import { PublicFooter } from "@/components/legal/public-footer";
import { PlanCards } from "@/components/plans/plan-cards";
import { TRIAL_DAYS } from "@/lib/subscription";
import { inviteOnly } from "@/lib/signup-policy";

// Public, like /terms (auth-gate lets everyone through). Linked from the login
// and register pages; signed-in users are pointed to their own /subscription.
export const metadata = {
  title: "מסלולים ומחירים — מרפאה אישית",
  description: "מנוי היכרות חינם ל-30 יום, ואז מנוי חודשי או שנתי. בלי חיוב אוטומטי.",
};
export const dynamic = "force-dynamic";

const CTA_PRIMARY =
  "inline-flex items-center justify-center h-11 px-5 rounded-xl font-medium text-sm bg-gradient-to-b from-sage-500 to-sage-600 text-cream-50 shadow-glow hover:from-sage-600 hover:to-sage-700";
const CTA_SECONDARY =
  "inline-flex items-center justify-center h-11 px-5 rounded-xl font-medium text-sm bg-white/70 text-ink border border-cream-300 hover:bg-white";

export default async function PricingPage() {
  const session = await auth();
  const signedIn = !!session?.user?.id;
  // While sign-up is by invitation the buttons ask to join instead of
  // promising a free start (signup-policy.ts; /register explains)
  const byInvite = inviteOnly();

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4 mb-10">
          <Link href={signedIn ? "/dashboard" : "/"} className="flex items-center gap-3">
            <LogoMark size={40} />
            <Wordmark className="text-xl" />
          </Link>
          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="text-sm text-sage-600 hover:text-sage-700 font-medium"
          >
            {signedIn ? "חזרה למערכת" : "כניסה"}
          </Link>
        </header>

        <main>
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-ink">מסלולים ומחירים</h1>
          <p className="text-ink-muted mt-3 leading-relaxed max-w-xl mx-auto text-balance">
            מתחילים במנוי היכרות חינם, וממשיכים במסלול שמתאים לך. הרכישה נעשית מתוך המערכת,
            בעמוד ״מנוי ומסלולים״.
          </p>
        </div>

        <PlanCards
          trial={{
            action: signedIn ? null : (
              <Link href="/register" className={`${CTA_PRIMARY} w-full`}>
                {byInvite ? "בקשת הצטרפות" : `התחלת ${TRIAL_DAYS} יום חינם`}
              </Link>
            ),
          }}
        />

        <div className="mt-8 rounded-2xl border border-sage-100 bg-sage-50/60 px-5 py-5 text-center">
          {signedIn ? (
            <>
              <p className="text-ink-soft text-sm">הרכישה והחידוש נעשים מתוך המערכת.</p>
              <Link href="/subscription" className={`${CTA_PRIMARY} mt-3`}>
                למנוי שלי
              </Link>
            </>
          ) : (
            <>
              <p className="text-ink-soft text-sm">
                {byInvite
                  ? "ההרשמה כרגע בהזמנה בלבד. אחרי ההצטרפות עובדים חודש בחינם, ואז בוחרים מסלול בעמוד ״מנוי ומסלולים״ שבתפריט."
                  : "איך קונים? נרשמים, עובדים חודש בחינם, ואז בוחרים מסלול בעמוד ״מנוי ומסלולים״ שבתפריט."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link href="/register" className={CTA_PRIMARY}>
                  {byInvite ? "בקשת הצטרפות" : "התחלת ניסיון חינם"}
                </Link>
                <Link href="/login" className={CTA_SECONDARY}>
                  כבר יש לי חשבון — כניסה
                </Link>
              </div>
            </>
          )}
        </div>

        </main>

        <PublicFooter className="mt-10" />
      </div>
    </div>
  );
}
