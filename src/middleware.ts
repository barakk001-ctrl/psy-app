import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except API routes, static files and Next internals.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
