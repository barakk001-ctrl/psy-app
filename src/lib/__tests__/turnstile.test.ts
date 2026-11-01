import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_FIELD, passesTurnstile, turnstileSiteKey } from "@/lib/turnstile";

const ON = { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" };

function form(token?: string): FormData {
  const fd = new FormData();
  if (token) fd.set(TURNSTILE_FIELD, token);
  return fd;
}
const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("off unless both keys are set", () => {
  it("no site key for the browser", () => {
    expect(turnstileSiteKey({})).toBeNull();
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: "site" })).toBeNull();
    expect(turnstileSiteKey({ TURNSTILE_SECRET_KEY: "secret" })).toBeNull();
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: " ", TURNSTILE_SECRET_KEY: "secret" })).toBeNull();
    expect(turnstileSiteKey(ON)).toBe("site");
  });

  it("everything passes and Cloudflare is never called", async () => {
    const f = answer({ success: false });
    expect(await passesTurnstile(form(), "1.1.1.1", {}, f)).toBe(true);
    expect(await passesTurnstile(form(), "1.1.1.1", { TURNSTILE_SITE_KEY: "site" }, f)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("on", () => {
  it("a form with no token is refused without calling Cloudflare", async () => {
    const f = answer({ success: true });
    expect(await passesTurnstile(form(), "1.1.1.1", ON, f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("a good token passes, and the secret + token + IP are sent", async () => {
    const f = answer({ success: true });
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, f)).toBe(true);
    const body = (f as unknown as { mock: { calls: [string, { body: URLSearchParams }][] } }).mock.calls[0][1].body;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.1.1.1");
  });

  it("a shared or cut-down address is not sent as the visitor's", async () => {
    for (const ip of ["unknown", "2a02:6b8:0:1::/64"]) {
      const f = answer({ success: true });
      await passesTurnstile(form("tok"), ip, ON, f);
      const body = (f as unknown as { mock: { calls: [string, { body: URLSearchParams }][] } }).mock.calls[0][1].body;
      expect(body.has("remoteip")).toBe(false);
    }
  });

  it("a bad token is refused", async () => {
    const f = answer({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, f)).toBe(false);
  });

  it("a used token is refused", async () => {
    const f = answer({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, f)).toBe(false);
  });

  it("a problem that isn't the visitor's lets them through", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrongSecret = answer({ success: false, "error-codes": ["invalid-input-secret"] });
    const outage = answer({}, 503);
    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, wrongSecret)).toBe(true);
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, outage)).toBe(true);
    expect(await passesTurnstile(form("tok"), "1.1.1.1", ON, offline)).toBe(true);
    expect(log).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });
});
