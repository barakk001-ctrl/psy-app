import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except API routes, static files, Next internals,
  // and PWA assets (manifest + icons must be public for install to work).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|fonts/).*)",
  ],
};
