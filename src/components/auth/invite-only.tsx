import Link from "next/link";
import { JOIN_REQUEST_EMAIL } from "@/lib/signup-policy";

/**
 * /register while sign-up is by invitation (signup-policy.ts): how to ask to
 * join, instead of a form that would only refuse. Invited people continue to
 * the form; existing users go to sign in.
 */
export function InviteOnly({ googleNotInvited = false }: { googleNotInvited?: boolean }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">הצטרפות</h1>
        <p className="text-ink-muted mt-2">מרפאה אישית — ניהול קליניקה למטפלים</p>
      </div>

      {googleNotInvited && (
        <p className="mb-4 rounded-xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft leading-relaxed">
          לחשבון ה-Google שבחרת עדיין אין הזמנה להצטרפות.
        </p>
      )}

      <div className="rounded-2xl border border-sage-100 bg-sage-50/70 px-5 py-5">
        <p className="text-ink leading-relaxed">ההרשמה כרגע בהזמנה בלבד.</p>
        <p className="text-ink-soft mt-2 leading-relaxed">
          לבקשת הצטרפות:{" "}
          <a
            href={`mailto:${JOIN_REQUEST_EMAIL}?subject=${encodeURIComponent("בקשת הצטרפות למרפאה אישית")}`}
            className="font-medium text-sage-700 underline underline-offset-2"
          >
            <span dir="ltr">{JOIN_REQUEST_EMAIL}</span>
          </a>
        </p>
      </div>

      <p className="text-sm text-ink-muted mt-8 text-center">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="text-sage-600 hover:text-sage-700 font-medium">
          התחברות
        </Link>
      </p>
      <p className="text-sm text-ink-muted mt-2 text-center">
        קיבלת הזמנה?{" "}
        <Link href="/register?invite=1" className="text-sage-600 hover:text-sage-700 font-medium">
          להרשמה
        </Link>
        {" · "}
        <Link href="/pricing" className="text-sage-600 hover:text-sage-700 underline underline-offset-2">
          מסלולים ומחירים
        </Link>
      </p>
    </div>
  );
}
