import { RegisterForm } from "@/components/auth/register-form";
import { InviteOnly } from "@/components/auth/invite-only";
import { isGoogleConfigured } from "@/lib/google-auth";
import { inviteOnly } from "@/lib/signup-policy";
import { normalizeInviteCode } from "@/lib/invite-codes";
import { isInviteUsable } from "@/lib/invite-store";
import { turnstileSiteKey } from "@/lib/turnstile";

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
  // person continues to the form: ?invite=1 for those on the list, and
  // ?invite=CODE from an invitation link. The server checks both again.
  const closed = inviteOnly();
  const inviteCode = normalizeInviteCode(sp.invite);
  const inviteGood = !!inviteCode && (await isInviteUsable(inviteCode));
  if (closed && (sp.google === "not-invited" || (sp.invite !== "1" && !inviteGood))) {
    return (
      <InviteOnly
        googleNotInvited={sp.google === "not-invited"}
        inviteInvalid={!!sp.invite && sp.invite !== "1" && !inviteGood}
      />
    );
  }

  const notice =
    sp.error === "rate"
      ? "יותר מדי ניסיונות הרשמה. נסו שוב מאוחר יותר."
      : googleEnabled && sp.google === "agreement"
        ? "כדי לפתוח חשבון חדש עם Google, יש לסמן קודם את אישור התנאים וההסכם ואז ללחוץ שוב על \"המשך עם Google\"."
        : undefined;
  return (
    <RegisterForm
      googleEnabled={googleEnabled}
      notice={notice}
      turnstileKey={turnstileSiteKey()}
      inviteCode={closed && inviteGood ? inviteCode : null}
      askInviteCode={closed && !inviteGood}
    />
  );
}
