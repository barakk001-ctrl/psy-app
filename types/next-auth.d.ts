import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    /**
     * Set (with `user` null) after a Google sign-in whose account has 2FA on,
     * until the code is entered at /login/two-factor. Never a signed-in user.
     */
    twoFactorPending?: { userId: string; email: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    /** Google sign-in waiting for the TOTP/backup code — see src/lib/auth-gate.ts */
    pending2fa?: { userId: string; since: number };
  }
}
