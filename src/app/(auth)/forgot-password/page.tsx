import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

// Rendered per request rather than prerendered at build time: on Railway's EU
// builder, prerendering this page hit a Next.js bundler error ("Could not find
// the module … in the React Client Manifest") that the US builder never did.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
