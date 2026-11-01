import { ConfirmEmailForm, LinkExpired } from "@/components/auth/confirm-email-form";
import { findUserByVerifyToken } from "@/lib/email-verification-store";

// Reads the token at request time. Opening the page changes nothing (mail
// scanners open links); the address is confirmed only by the form's action.
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await findUserByVerifyToken(token);
  if (!user?.hashedPassword) return <LinkExpired />;
  return <ConfirmEmailForm token={token} />;
}
