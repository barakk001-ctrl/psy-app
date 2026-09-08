import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/agreement"];

export default {
  providers: [], // real providers added in auth.ts (Node runtime only)
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

      // The agreement text is readable by everyone — guests during
      // registration and signed-in users during re-acceptance.
      if (path === "/agreement") return true;

      if (isPublic) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
