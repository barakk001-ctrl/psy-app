import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthSwitch } from "@/components/auth/auth-switch";
import { ExplainerVideo } from "@/components/auth/explainer-video";
import { isGoogleConfigured } from "@/lib/google-auth";

// Reads the environment (Google keys) and ?error= at request time
export const dynamic = "force-dynamic";
export const metadata = { title: "כניסה — מרפאה אישית" };

/** ?error= from a Google round-trip (Auth.js error types + our own codes) → Hebrew. */
function loginNotice(error: string | undefined): string | undefined {
  if (!error) return undefined;
  switch (error) {
    case "google_unverified":
      return "כתובת האימייל בחשבון Google הזה אינה מאומתת, ולכן אי אפשר להתחבר איתו.";
    case "2fa_expired":
      return "עבר יותר מדי זמן מאז ההתחברות — יש להתחבר שוב.";
    case "AccessDenied":
      return "ההתחברות עם Google נדחתה.";
    default:
      return "ההתחברות עם Google לא הצליחה. נסו שוב.";
  }
}

/** ?reason= from the automatic sign-out (src/components/security/idle-guard.tsx). */
function signedOutInfo(reason: string | undefined, verified: string | undefined): string | undefined {
  if (verified === "1") return "כתובת האימייל אושרה. אפשר להתחבר.";
  if (reason === "idle") return "המערכת התנתקה עקב חוסר פעילות. כדי להמשיך יש להתחבר שוב.";
  if (reason === "absolute") return "מטעמי אבטחה יש להתחבר מחדש אחרי 12 שעות.";
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const [error, reason, verified] = [one(sp.error), one(sp.reason), one(sp.verified)];
  return (
    <div>
      <AuthSwitch current="login" searchParams={sp} />
      <LoginForm
        googleEnabled={isGoogleConfigured()}
        notice={loginNotice(error)}
        info={signedOutInfo(reason, verified)}
      />
      <div className="mt-6 pt-5 border-t border-cream-200 text-center">
        <ExplainerVideo />
        <p className="mt-4 text-xs text-ink-muted">
          <Link href="/accessibility" className="underline underline-offset-2">
            הצהרת נגישות
          </Link>
        </p>
      </div>
    </div>
  );
}
