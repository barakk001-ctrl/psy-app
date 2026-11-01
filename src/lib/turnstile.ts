// Cloudflare Turnstile on the public forms that send email or take data:
// sign-up, code send, password reset and /request. Tested in turnstile.test.ts.
//
// Off until BOTH TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set: then no
// widget, no script and no call to Cloudflare. The site key is public and goes
// from the server page to the form as a prop, so setting it needs no rebuild.
//
// Turnstile protects the forms, and must not be what keeps someone out of
// their account, so a problem on our side or Cloudflare's (network, outage, a
// wrong secret) lets the visitor through and is logged. Rate limits still
// apply. Only Cloudflare's own "this token is not valid" refuses.

type Env = Record<string, string | undefined>;

export const TURNSTILE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ERROR = "בדיקת האבטחה לא הושלמה. נסו שוב בעוד רגע.";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 4000;

/** Error codes that are about our keys or their service, not about the visitor. */
const NOT_THE_VISITOR = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

function keys(env: Env): { site: string; secret: string } | null {
  const site = env.TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  return site && secret ? { site, secret } : null;
}

/** The site key for the browser, or null while Turnstile is off. */
export function turnstileSiteKey(env: Env = process.env): string | null {
  return keys(env)?.site ?? null;
}

/**
 * Whether the form's token is good; always true while Turnstile is off. `ip`
 * is sent to Cloudflare when known, as its siteverify API expects.
 */
export async function passesTurnstile(
  formData: FormData,
  ip: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const k = keys(env);
  if (!k) return true;

  const token = formData.get(TURNSTILE_FIELD);
  if (typeof token !== "string" || !token) return false;

  try {
    const body = new URLSearchParams({ secret: k.secret, response: token });
    if (ip && ip !== "unknown" && !ip.includes("/")) body.set("remoteip", ip);
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[turnstile] verify answered ${res.status}, letting through`);
      return true;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return true;
    const codes = data["error-codes"] ?? [];
    if (codes.some((c) => NOT_THE_VISITOR.has(c))) {
      console.error(`[turnstile] ${codes.join(",")}, letting through`);
      return true;
    }
    return false;
  } catch {
    console.error("[turnstile] verify unreachable, letting through");
    return true;
  }
}
