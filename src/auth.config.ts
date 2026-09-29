import type { NextAuthConfig } from "next-auth";
import { gateRequest, sessionForToken } from "@/lib/auth-gate";

export default {
  providers: [], // real providers added in auth.ts (Node runtime only)
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
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    // A 2FA-pending (or otherwise id-less) token yields a session with no
    // user, so it counts as signed out everywhere — see src/lib/auth-gate.ts.
    async session({ session, token }) {
      return sessionForToken(session, token, Date.now());
    },
  },
} satisfies NextAuthConfig;
