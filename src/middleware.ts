import NextAuth from "next-auth";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import authConfig from "@/auth.config";
import { withPublicOrigin } from "@/lib/request-origin";

// `auth` called with (request, event) is the Auth.js middleware (its types
// only describe the wrapper form).
const authMiddleware = NextAuth(authConfig).auth as unknown as NextMiddleware;

// Behind Railway's proxy the middleware sees a localhost URL; give Auth.js the
// public address the request came in on (mirpaa.app or the old Railway one),
// so its redirects stay on that address. See src/lib/request-origin.ts.
export function middleware(req: NextRequest, ev: NextFetchEvent) {
  return authMiddleware(withPublicOrigin(req), ev);
}

export const config = {
  // Protect everything except API routes, static files, Next internals,
  // and PWA assets (manifest + icons must be public for install to work).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|fonts/|request/|explainer.mp4).*)",
  ],
};
