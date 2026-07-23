import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashBackupCode, looksLikeBackupCode, verifyTotp } from "@/lib/totp";
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

        // Two-factor: when enabled, a valid rotating code OR an unused
        // one-time backup code is mandatory — enforced here so it cannot be
        // bypassed around the login form.
        if (user.totpEnabled && user.totpSecret) {
          const input = parsed.data.totp ?? "";
          try {
            if (looksLikeBackupCode(input)) {
              const hashes: string[] = user.totpBackupCodes
                ? JSON.parse(user.totpBackupCodes)
                : [];
              const hash = hashBackupCode(input);
              if (!hashes.includes(hash)) return null;
              // Consume: a backup code works exactly once
              await db.user.update({
                where: { id: user.id },
                data: {
                  totpBackupCodes: JSON.stringify(hashes.filter((h) => h !== hash)),
                },
              });
            } else {
              const secret = decryptSecret(user.totpSecret);
              if (!verifyTotp(secret, input)) return null;
            }
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
