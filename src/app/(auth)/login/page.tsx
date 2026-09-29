import { LoginForm } from "@/components/auth/login-form";
import { ExplainerVideo } from "@/components/auth/explainer-video";
import { isGoogleConfigured } from "@/lib/google-auth";

// Reads the environment (Google keys) and ?error= at request time
export const dynamic = "force-dynamic";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <LoginForm googleEnabled={isGoogleConfigured()} notice={loginNotice(error)} />
      <div className="mt-6 pt-5 border-t border-cream-200 text-center">
        <ExplainerVideo />
      </div>
    </div>
  );
}
