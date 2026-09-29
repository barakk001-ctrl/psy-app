import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const dynamic = "force-dynamic";

/**
 * Second step of a Google sign-in when the account has 2FA on. The
 * middleware sends a pending session here and nowhere else; anyone without
 * one goes back to the login page.
 */
export default async function TwoFactorPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  if (!session?.twoFactorPending) redirect("/login?error=2fa_expired");
  return <TwoFactorForm email={session.twoFactorPending.email} />;
}
