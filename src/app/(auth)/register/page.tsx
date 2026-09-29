import { RegisterForm } from "@/components/auth/register-form";
import { isGoogleConfigured } from "@/lib/google-auth";

// Reads the environment (Google keys) and the query at request time
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const googleEnabled = isGoogleConfigured();
  const notice =
    sp.error === "rate"
      ? "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר."
      : googleEnabled && sp.google === "agreement"
        ? "כדי לפתוח חשבון חדש עם Google, יש לסמן קודם את אישור הסכם החזקת המידע ואז ללחוץ שוב על \"המשך עם Google\"."
        : undefined;
  return <RegisterForm googleEnabled={googleEnabled} notice={notice} />;
}
