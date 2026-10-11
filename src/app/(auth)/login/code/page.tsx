import { LoginCodeForm } from "./login-code-form";

// Per request, and the form sits next to its page: the EU builder dropped
// auth-route client components from the client manifest when prerendered
// (same fix as /forgot-password).
export const dynamic = "force-dynamic";

/** "כניסה עם קוד חד פעמי": email → 6-digit code → signed in (src/lib/login-code.ts). */
export default async function LoginCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <LoginCodeForm initialEmail={typeof email === "string" ? email.slice(0, 200) : ""} />;
}
