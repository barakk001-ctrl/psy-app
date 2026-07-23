import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { verifyTotp } from "@/lib/totp";
import authConfig from "@/auth.config";
import { loginSchema } from "@/server/validators/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!valid) return null;

        // Two-factor: when enabled, a valid rotating code is mandatory —
        // enforced here so it cannot be bypassed around the login form.
        if (user.totpEnabled && user.totpSecret) {
          try {
            const secret = decryptSecret(user.totpSecret);
            if (!verifyTotp(secret, parsed.data.totp ?? "")) return null;
          } catch {
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
});
