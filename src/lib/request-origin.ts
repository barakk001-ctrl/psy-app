import { NextRequest } from "next/server";

// Which public address ("origin") a request came in on.
//
// The app answers on more than one address — https://mirpaa.app (APP_URL) and
// the old Railway address, where the installed iPhone app still lives — and
// each must keep its own sign-in: cookies are per host, and Google returns to
// the callback on the address the sign-in started from. Auth.js can only do
// that when AUTH_URL / NEXTAUTH_URL is unset (either one pins every request to
// a single origin). Behind Railway's proxy Next.js hands route handlers and the
// middleware a `localhost:8080` URL, so we rebuild the public one from the
// forwarded headers — but only for an address on the trusted list; anything
// else gets the canonical address.

type Env = Record<string, string | undefined>;
type HeaderBag = { get(name: string): string | null };

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.origin;
  } catch {
    return null;
  }
}

/** The app's main public address (APP_URL; the older env names as fallbacks). */
export function canonicalOrigin(env: Env = process.env): string | null {
  return toOrigin(env.APP_URL) ?? toOrigin(env.AUTH_URL) ?? toOrigin(env.NEXTAUTH_URL);
}

/**
 * Every address the app answers on: the canonical one, APP_ALT_ORIGINS
 * (comma-separated — the old Railway address lives here) and
 * RAILWAY_PUBLIC_DOMAIN (which Railway points at the custom domain once one
 * exists, so it can't be relied on for the old address).
 */
export function trustedOrigins(env: Env = process.env): string[] {
  const list = [
    canonicalOrigin(env),
    ...(env.APP_ALT_ORIGINS ?? "").split(",").map((s) => toOrigin(s.trim())),
    toOrigin(env.RAILWAY_PUBLIC_DOMAIN),
  ];
  return [...new Set(list.filter((o): o is string => !!o))];
}

function firstValue(header: string | null): string | null {
  const v = header?.split(",")[0]?.trim();
  return v ? v : null;
}

/**
 * The public origin of a request: the forwarded host when it is trusted,
 * otherwise the canonical address. With nothing configured (local dev) the
 * request's own host is used as is.
 */
export function originFromHeaders(headers: HeaderBag, env: Env = process.env): string | null {
  const host = firstValue(headers.get("x-forwarded-host")) ?? firstValue(headers.get("host"));
  const proto = firstValue(headers.get("x-forwarded-proto")) ?? "https";
  const candidate = host ? toOrigin(`${proto.replace(/:$/, "")}://${host}`) : null;
  const trusted = trustedOrigins(env);
  if (trusted.length === 0) return candidate;
  if (candidate && trusted.includes(candidate)) return candidate;
  return canonicalOrigin(env) ?? trusted[0];
}

/**
 * The request with its URL moved to its public origin, for Auth.js (which
 * builds callback and redirect URLs from `req.url`). Untouched when AUTH_URL /
 * NEXTAUTH_URL is set — Auth.js overrides the origin itself then.
 */
export function withPublicOrigin(req: NextRequest, env: Env = process.env): NextRequest {
  if (env.AUTH_URL || env.NEXTAUTH_URL) return req;
  const origin = originFromHeaders(req.headers, env);
  const { href, origin: current } = req.nextUrl;
  if (!origin || origin === current) return req;
  return new NextRequest(href.replace(current, origin), req);
}
