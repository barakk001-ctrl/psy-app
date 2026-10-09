// Automatic sign-out after inactivity ("ניתוק אוטומטי") — the rules, shared by
// the server (the session token's clock, checked in the edge middleware and in
// every auth() call) and the browser (the warning dialog's timer). Pure and
// edge-safe: no Node, Prisma or DOM imports here.
//
// Two layers:
//   - Browser: activity (mouse, keys, touch, scroll, the tab coming back into
//     view) is shared between tabs; after `idleMinutes` without any, the page
//     saves unsaved summaries and signs out. A warning shows WARNING_MS before.
//   - Server: the session token carries `authTime` (sign-in) and `lastSeen`
//     (the last request). A request after `idleMinutes + SERVER_IDLE_GRACE_MS`
//     of silence, or `ABSOLUTE_SESSION_MS` after sign-in, finds no session —
//     so a laptop that slept or a tab closed and reopened hours later asks for
//     the password even though no browser timer ran.
// The grace keeps the server from ending a session the browser still thinks
// is alive: the browser only refreshes the server (HEARTBEAT_MS) every couple
// of minutes while she types, so its clock may run a little ahead.

export const IDLE_TIMEOUT_OPTIONS = [15, 30, 60] as const;
export type IdleTimeoutMinutes = (typeof IDLE_TIMEOUT_OPTIONS)[number];

/** 30 minutes: the usual choice for systems that hold clinical records. */
export const DEFAULT_IDLE_TIMEOUT_MINUTES: IdleTimeoutMinutes = 30;

/** The warning ("המערכת תתנתק בעוד…") shows this long before signing out. */
export const IDLE_WARNING_MS = 2 * 60_000;

/** Extra silence the server allows on top of the chosen timeout. */
export const SERVER_IDLE_GRACE_MS = 5 * 60_000;

/** A sign-in lasts at most this long, however active she is. */
export const ABSOLUTE_SESSION_MS = 12 * 60 * 60_000;

/**
 * The browser ends the 12-hour session this much before the server does, so
 * an unsaved summary can still be saved on the way out.
 */
export const ABSOLUTE_CLIENT_LEAD_MS = 60_000;

/** When the browser signs out for the 12-hour limit. */
export function clientAbsoluteDeadline(authTime: number | null | undefined): number | null {
  return typeof authTime === "number" && Number.isFinite(authTime)
    ? authTime + ABSOLUTE_SESSION_MS - ABSOLUTE_CLIENT_LEAD_MS
    : null;
}

/** The browser refreshes the server's clock at most this often while active. */
export const HEARTBEAT_MS = 2 * 60_000;

/**
 * Lifetime of the session cookie and the JWT inside it, refreshed on every
 * request: the longest timeout plus the grace. The token's own clock is the
 * real check; this only makes an abandoned cookie disappear on its own.
 */
export const SESSION_MAX_AGE_SECONDS =
  (Math.max(...IDLE_TIMEOUT_OPTIONS) * 60_000 + SERVER_IDLE_GRACE_MS) / 1000;

export function isIdleTimeoutOption(value: unknown): value is IdleTimeoutMinutes {
  return (IDLE_TIMEOUT_OPTIONS as readonly unknown[]).includes(value);
}

/** Anything that isn't one of the options (missing, tampered) → the default. */
export function normalizeIdleTimeout(value: unknown): IdleTimeoutMinutes {
  const n = typeof value === "string" ? Number(value) : value;
  return isIdleTimeoutOption(n) ? n : DEFAULT_IDLE_TIMEOUT_MINUTES;
}

// ---------------------------------------------------------------------------
// Server: the clock inside the session token

export type SessionClock = { authTime: number; lastSeen: number; idleMinutes: IdleTimeoutMinutes };

export type SessionClockToken = { authTime?: unknown; lastSeen?: unknown; idleMinutes?: unknown };

export type ClockCheck =
  | ({ ok: true } & SessionClock)
  | { ok: false; reason: "idle" | "absolute" };

/** The clock of a token minted at sign-in. */
export function freshSessionClock(idleMinutes: unknown, now: number): SessionClock {
  return { authTime: now, lastSeen: now, idleMinutes: normalizeIdleTimeout(idleMinutes) };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Checks a token's clock on a request and returns the refreshed clock
 * (`lastSeen` = now), or why the session is over.
 *
 * A token with no clock was issued before this feature shipped; it starts its
 * clock now rather than being signed out mid-use by the deploy (tokens are
 * encrypted with AUTH_SECRET, so a clock can't be stripped from a new one).
 */
export function checkSessionClock(token: SessionClockToken, now: number): ClockCheck {
  const idleMinutes = normalizeIdleTimeout(token.idleMinutes);
  const authTime = finiteNumber(token.authTime);
  const lastSeen = finiteNumber(token.lastSeen);
  if (authTime === null || lastSeen === null) {
    return { ok: true, authTime: authTime ?? now, lastSeen: now, idleMinutes };
  }
  if (now - authTime > ABSOLUTE_SESSION_MS) return { ok: false, reason: "absolute" };
  if (now - lastSeen > idleMinutes * 60_000 + SERVER_IDLE_GRACE_MS) {
    return { ok: false, reason: "idle" };
  }
  // A clock from the future (it shouldn't happen) never extends the session.
  return { ok: true, authTime: Math.min(authTime, now), lastSeen: now, idleMinutes };
}

// ---------------------------------------------------------------------------
// Browser: what the warning dialog shows

export type IdleReason = "idle" | "absolute";

export type IdlePhase =
  | { kind: "active" }
  | { kind: "warning"; reason: IdleReason; msLeft: number }
  | { kind: "expired"; reason: IdleReason };

export function idlePhase(input: {
  now: number;
  lastActivity: number;
  idleMinutes: number;
  /** Sign-in time + ABSOLUTE_SESSION_MS, when known */
  absoluteDeadline: number | null;
  warningMs?: number;
}): IdlePhase {
  const warningMs = input.warningMs ?? IDLE_WARNING_MS;
  const idleDeadline = input.lastActivity + input.idleMinutes * 60_000;
  const absolute = input.absoluteDeadline;
  const useAbsolute = absolute !== null && absolute <= idleDeadline;
  const deadline = useAbsolute ? absolute : idleDeadline;
  const reason: IdleReason = useAbsolute ? "absolute" : "idle";
  const msLeft = deadline - input.now;
  if (msLeft <= 0) return { kind: "expired", reason };
  if (msLeft <= warningMs) return { kind: "warning", reason, msLeft };
  return { kind: "active" };
}

/** "1:05" — minutes and seconds left, rounded up so it never shows 0:00 early. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Hebrew label for a timeout option, e.g. "שעה" / "30 דקות". */
export function idleTimeoutLabel(minutes: IdleTimeoutMinutes): string {
  return minutes === 60 ? "שעה" : `${minutes} דקות`;
}

/**
 * The `jwt` callback's work on an existing token (every request): refresh its
 * clock, or end the session (null). `update` is the payload of a session
 * update — only a valid `idleMinutes` is taken from it (Settings → ניתוק
 * אוטומטי), and only for a signed-in token; nothing else in a token can be
 * changed this way.
 */
export function refreshTokenClock<T extends object>(
  token: T,
  now: number,
  update?: unknown,
): T | null {
  const fields = token as SessionClockToken & { id?: unknown };
  const clock = checkSessionClock(fields, now);
  if (!clock.ok) return null;
  let idleMinutes = clock.idleMinutes;
  if (update && typeof update === "object" && typeof fields.id === "string" && fields.id) {
    const requested = (update as { idleMinutes?: unknown }).idleMinutes;
    if (isIdleTimeoutOption(requested)) idleMinutes = requested;
  }
  return { ...token, authTime: clock.authTime, lastSeen: clock.lastSeen, idleMinutes };
}
