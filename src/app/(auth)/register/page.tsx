import { RegisterForm } from "@/components/auth/register-form";
import { InviteOnly } from "@/components/auth/invite-only";
import { isGoogleConfigured } from "@/lib/google-auth";
import { inviteOnly } from "@/lib/signup-policy";

// Reads the environment (Google keys, sign-up mode) and the query at request time
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; error?: string; invite?: string }>;
}) {
  const sp = await searchParams;
  const googleEnabled = isGoogleConfigured();

  // By invitation (signup-policy.ts): how to ask to join, unless an invited
  // person continues to the form (?invite=1 — the server still checks the list)
  if (inviteOnly() && (sp.invite !== "1" || sp.google === "not-invited")) {
    return <InviteOnly googleNotInvited={sp.google === "not-invited"} />;
  }

  const notice =
    sp.error === "rate"
      ? "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר."
      : googleEnabled && sp.google === "agreement"
        ? "כדי לפתוח חשבון חדש עם Google, יש לסמן קודם את אישור הסכם החזקת המידע ואז ללחוץ שוב על \"המשך עם Google\"."
        : undefined;
  return <RegisterForm googleEnabled={googleEnabled} notice={notice} />;
}
