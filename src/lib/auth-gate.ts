// Who a session token belongs to, and what the middleware lets it reach.
// Pure and edge-safe (used by auth.config.ts in the middleware) — no Node or
// Prisma imports here.
//
// A token is one of three things:
//   - a normal signed-in user        → `token.id` is set, no `pending2fa`
//   - "2FA pending" (Google sign-in of a user with TOTP on, code not entered
//     yet)                            → `token.pending2fa`, and NO `token.id`
//   - nothing usable                  → anything else (treated as a guest)
// Only the first counts as logged in, everywhere: the session callback hides
// `user` for the other two, so every `session?.user?.id` guard (server
// actions, API routes, layouts) sees them as unauthenticated.

/** Where a 2FA-pending session is sent to enter its code. */
export const TWO_FACTOR_PATH = "/login/two-factor";

/** How long a Google sign-in may wait for its 2FA code before it lapses. */
export const PENDING_2FA_MAX_AGE_MS = 10 * 60_000;

export type PendingTwoFactor = { userId: string; since: number };

export type TokenLike = {
  id?: unknown;
  email?: unknown;
  pending2fa?: unknown;
};

export type AuthState =
  | { kind: "user"; userId: string }
  | { kind: "pending"; userId: string; email: string | null }
  | { kind: "none" };

function asPending(value: unknown): PendingTwoFactor | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.userId !== "string" || !v.userId) return null;
  if (typeof v.since !== "number" || !Number.isFinite(v.since)) return null;
  return { userId: v.userId, since: v.since };
}

export function resolveAuthState(token: TokenLike | null | undefined, now: number): AuthState {
  if (!token) return { kind: "none" };
  // A pending marker always wins: even if something set an id alongside it,
  // the code hasn't been entered, so this is not a signed-in user.
  if (token.pending2fa !== undefined && token.pending2fa !== null) {
    const pending = asPending(token.pending2fa);
    if (!pending) return { kind: "none" };
    const age = now - pending.since;
    if (age < 0 || age > PENDING_2FA_MAX_AGE_MS) return { kind: "none" };
    return {
      kind: "pending",
      userId: pending.userId,
      email: typeof token.email === "string" ? token.email : null,
    };
  }
  if (typeof token.id === "string" && token.id) return { kind: "user", userId: token.id };
  return { kind: "none" };
}

export type SessionLike = {
  user?: { id?: string; name?: string | null; email?: string | null; image?: string | null } | null;
  expires: string;
  twoFactorPending?: { userId: string; email: string | null };
};

/**
 * The session object `auth()` returns. For anything but a normal user,
 * `user` is explicitly null — next-auth's server-side `auth()` otherwise falls
 * back to putting the raw token in `user`, which would look signed in.
 */
export function sessionForToken<S extends SessionLike>(session: S, token: TokenLike, now: number): S {
  const state = resolveAuthState(token, now);
  if (state.kind === "user") {
    return { ...session, user: { ...(session.user ?? {}), id: state.userId } };
  }
  if (state.kind === "pending") {
    return {
      expires: session.expires,
      user: null,
      twoFactorPending: { userId: state.userId, email: state.email },
    } as unknown as S;
  }
  return { expires: session.expires, user: null } as unknown as S;
}

export type GateDecision = { type: "allow" } | { type: "deny" } | { type: "redirect"; to: string };

export const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/agreement"];

/** The middleware's decision for one page request. */
export function gateRequest(
  path: string,
  session: { user?: { id?: string } | null; twoFactorPending?: unknown } | null | undefined,
): GateDecision {
  const isLoggedIn = !!session?.user?.id;
  const isPending = !isLoggedIn && !!session?.twoFactorPending;

  // The agreement and the terms are readable by everyone — guests during
  // registration and signed-in users during re-acceptance.
  if (path === "/agreement" || path === "/terms") return { type: "allow" };

  // 2FA pending: the code page and nothing else.
  if (isPending) {
    return path === TWO_FACTOR_PATH ? { type: "allow" } : { type: "redirect", to: TWO_FACTOR_PATH };
  }

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) {
    return isLoggedIn ? { type: "redirect", to: "/dashboard" } : { type: "allow" };
  }
  return isLoggedIn ? { type: "allow" } : { type: "deny" };
}
