import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { rateLimit } from "@/lib/rate-limit";
import { verifySecondFactor } from "@/lib/second-factor";
import { createPracticeUser } from "@/lib/practice-user";
import {
  GOOGLE_AGREEMENT_COOKIE,
  decideGoogleSignIn,
  isGoogleConfigured,
  normalizeEmail,
  tokenForGoogleUser,
} from "@/lib/google-auth";
import authConfig from "@/auth.config";
import { loginSchema } from "@/server/validators/auth";

/** The code page refuses further tries for a while — shown as its own message. */
export class TwoFactorRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const FIFTEEN_MIN = 15 * 60_000;

function ipOf(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

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
          if (!(await verifySecondFactor(user, parsed.data.totp ?? ""))) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),

    // Second step of a Google sign-in for an account with 2FA on: turns the
    // current "2FA pending" session into a normal one once the code is right.
    // The user comes from the pending session cookie, never from the request
    // body; rate-limited here too so a direct POST to the callback URL gets
    // the same limits as the /login/two-factor form.
    Credentials({
      id: "two-factor",
      name: "two-factor",
      credentials: { code: { label: "Code", type: "text" } },
      async authorize(credentials, request) {
        const session = await auth();
        const pending = session?.twoFactorPending;
        if (!pending) return null;

        const user = await db.user.findUnique({ where: { id: pending.userId } });
        if (!user?.totpEnabled || !user.totpSecret) return null;

        const byEmail = rateLimit(`login:email:${user.email}`, { limit: 8, windowMs: FIFTEEN_MIN });
        const byIp = rateLimit(`login:ip:${ipOf(request.headers)}`, { limit: 25, windowMs: FIFTEEN_MIN });
        if (!byEmail.allowed || !byIp.allowed) throw new TwoFactorRateLimited();

        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!(await verifySecondFactor(user, code))) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),

    // Registered only when both keys exist, so without them nothing changes.
    ...(isGoogleConfigured()
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            // Always show the account chooser — a shared computer shouldn't
            // silently sign in whoever was last signed in to Google.
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email ? normalizeEmail(profile.email) : null;
      const existing = email
        ? await db.user.findUnique({ where: { email }, select: { id: true } })
        : null;
      const agreementCookie = (await cookies()).get(GOOGLE_AGREEMENT_COOKIE)?.value;

      const decision = decideGoogleSignIn({
        email,
        emailVerified: profile?.email_verified,
        googleName: profile?.name,
        existingUserId: existing?.id ?? null,
        agreementAccepted: agreementCookie === AGREEMENT_VERSION,
      });

      switch (decision.type) {
        case "reject":
          return "/login?error=google_unverified";
        case "need-agreement":
          return "/register?google=agreement";
        case "link":
          return true;
        case "create": {
          const ip = ipOf(await headers());
          if (!rateLimit(`register:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 }).allowed) {
            return "/register?error=rate";
          }
          try {
            await createPracticeUser({ email: decision.email, name: decision.name, hashedPassword: null });
          } catch (err) {
            // Two tabs racing: the email is unique, so the other one won — sign
            // in to that account rather than failing.
            const raced = await db.user.findUnique({ where: { email: decision.email }, select: { id: true } });
            if (!raced) throw err;
          }
          return true;
        }
      }
    },

    async jwt(params) {
      const { account, profile } = params;
      if (account?.provider === "google") {
        // A fresh token for OUR user (Google's own id/picture are dropped).
        const email = profile?.email ? normalizeEmail(profile.email) : "";
        const user = email
          ? await db.user.findUnique({
              where: { email },
              select: { id: true, name: true, email: true, totpEnabled: true, totpSecret: true },
            })
          : null;
        if (!user) return null; // no session at all
        return tokenForGoogleUser(user, Date.now());
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});
