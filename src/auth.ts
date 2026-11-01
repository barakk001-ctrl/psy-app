import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { LOGIN_LIMITS } from "@/lib/login-lockout";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/lib/login-lockout-store";
import { verifySecondFactor } from "@/lib/second-factor";
import { logAudit } from "@/lib/audit";
import { googleVerifiedUpdate } from "@/lib/email-verification";
import { LOGIN_CODE_LIMITS, loginCodeRateKeys } from "@/lib/login-code";
import { consumeLoginCode } from "@/lib/login-code-store";
import { createPracticeUser } from "@/lib/practice-user";
import { canCreateAccount } from "@/lib/signup-policy";
import {
  GOOGLE_AGREEMENT_COOKIE,
  decideGoogleSignIn,
  displayNameFor,
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

/** Too many one-time-code tries for this email or IP. */
export class LoginCodeRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

/** Too many password tries, or the password is locked for now (login-lockout.ts). */
export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

/** The password was right but the address isn't confirmed yet: no session. */
export class EmailNotVerified extends CredentialsSignin {
  code = "email_unverified";
}

/**
 * Compared when there is no password to check, so an unknown address takes as
 * long to answer as a known one. Not the hash of anything in use.
 */
const NO_ACCOUNT_HASH = "$2a$10$EpYxeUKAgAdvQny.r/Mqduk18paE4uP102bjVP.2BIEUmdRTymKYG";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  ...authConfig, // includes `session` (JWT, idle-expiry lifetime)
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Enforced here so a direct POST to the callback URL meets them too.
        // Own buckets: the login form counts its tries in loginAction, and
        // one attempt there must not count twice.
        const ip = clientIpFrom(request.headers);
        const byEmail = await rateLimit(`login-auth:email:${email}`, LOGIN_LIMITS.perEmail);
        const byIp = await rateLimit(`login-auth:ip:${ip}`, LOGIN_LIMITS.perIp);
        if (!byEmail.allowed || !byIp.allowed || (await isLoginLocked(email))) {
          throw new LoginRateLimited();
        }

        const user = await db.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(parsed.data.password, user?.hashedPassword ?? NO_ACCOUNT_HASH);
        if (!user?.hashedPassword || !valid) {
          await recordLoginFailure(email);
          return null;
        }

        // Only after the password, so this tells a stranger nothing
        if (!user.emailVerifiedAt) throw new EmailNotVerified();

        // Two-factor: when enabled, a valid rotating code OR an unused
        // one-time backup code is mandatory — enforced here so it cannot be
        // bypassed around the login form.
        if (user.totpEnabled && user.totpSecret) {
          if (!(await verifySecondFactor(user, parsed.data.totp ?? ""))) {
            await recordLoginFailure(email);
            return null;
          }
        }

        await clearLoginFailures(email);
        await logAudit(user.id, "LOGIN_PASSWORD");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          idleTimeoutMinutes: user.idleTimeoutMinutes,
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

        // By user, not by the password's per-address bucket: a stranger
        // typing wrong passwords must not block this step (login-lockout.ts)
        const byUser = await rateLimit(`login-2fa:user:${user.id}`, LOGIN_LIMITS.perEmail);
        const byIp = await rateLimit(`login:ip:${clientIpFrom(request.headers)}`, LOGIN_LIMITS.perIp);
        if (!byUser.allowed || !byIp.allowed) throw new TwoFactorRateLimited();

        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!(await verifySecondFactor(user, code))) return null;

        await clearLoginFailures(user.email);
        await logAudit(user.id, "LOGIN_TWO_FACTOR");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          idleTimeoutMinutes: user.idleTimeoutMinutes,
        };
      },
    }),

    // "כניסה עם קוד חד פעמי": the 6-digit code sent by email (SMS later) to
    // the account's address. It proves the same thing as a password-reset
    // link: control of the mailbox. So it replaces the password, never the
    // authenticator: with 2FA on, the jwt callback below mints a pending
    // token and the middleware sends her to /login/two-factor, exactly as
    // after Google. Limits share the password login's buckets.
    Credentials({
      id: "email-code",
      name: "email-code",
      credentials: { email: { label: "Email", type: "email" }, code: { label: "Code", type: "text" } },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? normalizeEmail(credentials.email) : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!email || !code) return null;

        const keys = loginCodeRateKeys(email, clientIpFrom(request.headers));
        const byEmail = await rateLimit(keys.verifyPerEmail, LOGIN_CODE_LIMITS.verifyPerEmail);
        const byIp = await rateLimit(keys.verifyPerIp, LOGIN_CODE_LIMITS.verifyPerIp);
        if (!byEmail.allowed || !byIp.allowed) throw new LoginCodeRateLimited();

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, idleTimeoutMinutes: true, emailVerifiedAt: true },
        });
        if (!user?.emailVerifiedAt) return null;
        if (!(await consumeLoginCode(user.id, code))) return null;
        await clearLoginFailures(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          idleTimeoutMinutes: user.idleTimeoutMinutes,
        };
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
        ? await db.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } })
        : null;
      const agreementCookie = (await cookies()).get(GOOGLE_AGREEMENT_COOKIE)?.value;

      const decision = decideGoogleSignIn({
        email,
        emailVerified: profile?.email_verified,
        googleName: profile?.name,
        existingUserId: existing?.id ?? null,
        agreementAccepted: agreementCookie === AGREEMENT_VERSION,
        // The invitation list applies only to creating an account
        creationAllowed: !!email && canCreateAccount(email),
      });

      switch (decision.type) {
        case "reject":
          return "/login?error=google_unverified";
        case "need-agreement":
          return "/register?invite=1&google=agreement";
        case "not-invited":
          return "/register?google=not-invited";
        case "link":
          // A sign-up still waiting for its link: Google has now proven the address
          if (!existing?.emailVerifiedAt) {
            await db.user.update({
              where: { id: decision.userId },
              data: googleVerifiedUpdate(new Date(), displayNameFor(profile?.name, email ?? "")),
            });
          }
          if (email) await clearLoginFailures(email);
          return true;
        case "create": {
          const ip = clientIpFrom(await headers());
          if (!(await rateLimit(`register:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 })).allowed) {
            return "/register?error=rate";
          }
          try {
            await createPracticeUser({
              email: decision.email,
              name: decision.name,
              hashedPassword: null,
              emailVerified: true,
            });
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
      const { account, profile, user: signedIn } = params;
      if (account?.provider === "google" || account?.provider === "email-code") {
        // A fresh token for OUR user (Google's own id/picture are dropped).
        const from = account.provider === "google" ? profile?.email : signedIn?.email;
        const email = from ? normalizeEmail(from) : "";
        const user = email
          ? await db.user.findUnique({
              where: { email },
              select: {
                id: true,
                name: true,
                email: true,
                totpEnabled: true,
                totpSecret: true,
                idleTimeoutMinutes: true,
              },
            })
          : null;
        if (!user) return null; // no session at all
        const token = tokenForGoogleUser(user, Date.now());
        // A pending token is logged when its 2FA code is entered (LOGIN_TWO_FACTOR)
        if (token.id) await logAudit(user.id, account.provider === "google" ? "LOGIN_GOOGLE" : "LOGIN_EMAIL_CODE");
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});
