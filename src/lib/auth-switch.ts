/**
 * The "כניסה / הצטרפות ומסלולים" switch under the logo on /login and /register.
 *
 * Switching keeps the query string, so an invitation (?invite=1 or
 * ?invite=CODE) and a callbackUrl survive a trip to the other page and back.
 * Only the one-shot notices are dropped: they describe something that just
 * happened on the page that showed them, and would show a stale or wrong
 * message on the other one (e.g. /login?error=… is a Google sign-in error,
 * while /register?error=rate means "too many sign-ups").
 */

export type AuthPage = "login" | "register";

export const AUTH_PAGE_PATHS: Record<AuthPage, string> = {
  login: "/login",
  register: "/register",
};

/** Query parameters that are notices about the last action, not state to carry */
export const ONE_SHOT_PARAMS = ["error", "reason", "verified", "google"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

/** The address of `target`, carrying over what is worth keeping from `params`. */
export function authSwitchHref(target: AuthPage, params: SearchParams = {}): string {
  const drop = new Set<string>(ONE_SHOT_PARAMS);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (drop.has(key) || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
  }
  const qs = query.toString();
  return qs ? `${AUTH_PAGE_PATHS[target]}?${qs}` : AUTH_PAGE_PATHS[target];
}
