import { describe, expect, it } from "vitest";
import { authSwitchHref } from "@/lib/auth-switch";

describe("authSwitchHref", () => {
  it("gives the plain address with no query", () => {
    expect(authSwitchHref("login")).toBe("/login");
    expect(authSwitchHref("register", {})).toBe("/register");
  });

  it("keeps an invitation in both directions", () => {
    expect(authSwitchHref("login", { invite: "1" })).toBe("/login?invite=1");
    expect(authSwitchHref("register", { invite: "1" })).toBe("/register?invite=1");
    expect(authSwitchHref("register", { invite: "ABCD2345EFGH" })).toBe("/register?invite=ABCD2345EFGH");
  });

  it("keeps a callbackUrl, encoded", () => {
    expect(authSwitchHref("register", { callbackUrl: "/clients?view=inactive" })).toBe(
      "/register?callbackUrl=%2Fclients%3Fview%3Dinactive",
    );
  });

  it("drops one-shot notices so the other page shows no stale message", () => {
    expect(
      authSwitchHref("register", { error: "AccessDenied", reason: "idle", verified: "1", invite: "1" }),
    ).toBe("/register?invite=1");
    expect(authSwitchHref("login", { google: "not-invited", error: "rate" })).toBe("/login");
  });

  it("keeps repeated and unknown parameters, skips undefined", () => {
    expect(authSwitchHref("login", { utm_source: ["a", "b"], x: undefined })).toBe(
      "/login?utm_source=a&utm_source=b",
    );
  });
});
