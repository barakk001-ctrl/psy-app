import type { NextAuthConfig } from "next-auth";
import { gateRequest, sessionForToken } from "@/lib/auth-gate";
import { SESSION_MAX_AGE_SECONDS, freshSessionClock, refreshTokenClock } from "@/lib/idle-timeout";

export default {
  providers: [], // real providers added in auth.ts (Node runtime only)
  // Here, not in auth.ts, so the middleware re-issues the cookie with the
  // same lifetime. Every request slides it; the real idle / 12-hour limits
  // are the token's own clock, checked in the jwt callback below.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/login",
    // Google sign-in failures land on the login page with ?error=… (Hebrew
    // message there) instead of Auth.js's English error page.
    error: "/login",
  },
  // The session cookie's name is pinned. Auth.js derives it from the site
  // URL's protocol (`__Secure-authjs.session-token` on https), and the
  // production NEXTAUTH_URL has been http:// — switching it to https (needed
  // for Google's redirect URI) would otherwise rename the cookie and sign
  // everyone out. `secure` still follows the environment.
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    authorized({ auth, request }) {
      const decision = gateRequest(request.nextUrl.pathname, auth);
      if (decision.type === "redirect") {
        return Response.redirect(new URL(decision.to, request.nextUrl));
      }
      return decision.type === "allow";
    },
    // Sign-in mints a fresh clock; every later request (middleware, auth(),
    // /api/auth/session) refreshes it or — after too long without a request,
    // or 12 hours after sign-in — returns null, which clears the cookie.
    // See src/lib/idle-timeout.ts.
    async jwt({ token, user, trigger, session }) {
      const now = Date.now();
      if (user) {
        token.id = user.id;
        return { ...token, ...freshSessionClock(user.idleTimeoutMinutes, now) };
      }
      return refreshTokenClock(token, now, trigger === "update" ? session : undefined);
    },
    // A 2FA-pending (or otherwise id-less) token yields a session with no
    // user, so it counts as signed out everywhere — see src/lib/auth-gate.ts.
    async session({ session, token }) {
      const result = sessionForToken(session, token, Date.now());
      if (result.user?.id && typeof token.authTime === "number") {
        return { ...result, authTime: token.authTime };
      }
      return result;
    },
  },
} satisfies NextAuthConfig;
