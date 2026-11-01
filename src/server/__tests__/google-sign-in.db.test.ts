import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// Sign-up by Google and invite codes on a real Postgres, without Google: the
// callback's whole logic is googleSignIn(), and nothing here mocks the database.
// Skipped unless TEST_DATABASE_URL is set.

vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "invites");
    process.env.DATABASE_URL = u.toString();
    process.env.AUTH_SECRET = "test-only-secret";
  }
});

const AGREED = "agreed";
vi.mock("@/lib/agreement", () => ({ AGREEMENT_VERSION: "agreed" }));

let ipCounter = 0;
const headers = () => new Headers({ "x-forwarded-for": `10.9.0.${++ipCounter}` });
const profile = (email: string, name = "משתמש בדיקה") => ({ email, email_verified: true, name });

describe.skipIf(!TEST_DATABASE_URL)("Google sign-up and invite codes (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let googleSignIn: typeof import("@/lib/google-sign-in").googleSignIn;
  let createPracticeUser: typeof import("@/lib/practice-user").createPracticeUser;

  const invite = (data: { code: string; maxUses?: number; expiresAt?: Date; revokedAt?: Date }) =>
    db.inviteCode.create({ data: { createdById: "admin", ...data } });
  const user = (email: string) => db.user.findUnique({ where: { email } });

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("invites");
    db = (await import("@/lib/db")).dbAll;
    ({ googleSignIn } = await import("@/lib/google-sign-in"));
    ({ createPracticeUser } = await import("@/lib/practice-user"));
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    vi.stubEnv("SIGNUP_OPEN", "");
    vi.stubEnv("ALLOWED_EMAILS", "listed@example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const signIn = (email: string, opts: { invite?: string; agreement?: string } = {}) =>
    googleSignIn({
      profile: profile(email),
      agreement: "agreement" in opts ? opts.agreement : AGREED,
      invite: opts.invite,
      headers: headers(),
    });

  it("no code and not on the list: refused, no account", async () => {
    expect(await signIn("new@example.test")).toBe("/register?google=not-invited");
    expect(await user("new@example.test")).toBeNull();
  });

  it("a good code creates a verified account and uses the code up", async () => {
    const inv = await invite({ code: "GDDDCDDE2345" });
    expect(await signIn("new@example.test", { invite: "GDDDCDDE2345" })).toBe(true);
    const u = await user("new@example.test");
    expect(u?.emailVerifiedAt).toBeTruthy();
    expect(u?.hashedPassword).toBeNull();
    expect(u?.inviteCodeId).toBe(inv.id);
    expect(u?.termsVersion).toBeTruthy();
    expect(u?.termsAcceptedAt).toBeTruthy();
    expect(u?.agreementVersion).toBe(AGREED);
    expect((await db.inviteCode.findUnique({ where: { id: inv.id } }))?.usedCount).toBe(1);
  });

  it("a used, expired, revoked or unknown code is refused on the server", async () => {
    await invite({ code: "USEDCDDE2345" });
    await signIn("first@example.test", { invite: "USEDCDDE2345" });
    await invite({ code: "EXPXRED23456", expiresAt: new Date(Date.now() - 1000) });
    await invite({ code: "REVXKED23456", revokedAt: new Date() });
    for (const code of ["USEDCDDE2345", "EXPXRED23456", "REVXKED23456", "UNKNXWN23456"]) {
      expect(await signIn("second@example.test", { invite: code })).toBe("/register?google=not-invited");
    }
    expect(await user("second@example.test")).toBeNull();
  });

  it("the agreement is still required, and the code survives that detour", async () => {
    await invite({ code: "GDDDCDDE2345" });
    const r = await signIn("new@example.test", { invite: "GDDDCDDE2345", agreement: undefined });
    expect(r).toBe("/register?invite=GDDDCDDE2345&google=agreement");
    expect(await user("new@example.test")).toBeNull();
    expect((await db.inviteCode.findUnique({ where: { code: "GDDDCDDE2345" } }))?.usedCount).toBe(0);
  });

  it("an address on the list doesn't use a code up", async () => {
    await invite({ code: "GDDDCDDE2345" });
    expect(await signIn("listed@example.test", { invite: "GDDDCDDE2345" })).toBe(true);
    expect((await db.inviteCode.findUnique({ where: { code: "GDDDCDDE2345" } }))?.usedCount).toBe(0);
  });

  it("SIGNUP_OPEN lets anyone in without using a code", async () => {
    vi.stubEnv("SIGNUP_OPEN", "true");
    await invite({ code: "GDDDCDDE2345" });
    expect(await signIn("anyone@example.test", { invite: "GDDDCDDE2345" })).toBe(true);
    expect((await db.inviteCode.findUnique({ where: { code: "GDDDCDDE2345" } }))?.usedCount).toBe(0);
  });

  it("an existing user signs in, whatever the list, and doesn't use a code up", async () => {
    await createPracticeUser({ email: "old@example.test", name: "ותיק", hashedPassword: "x", emailVerified: true });
    await invite({ code: "GDDDCDDE2345" });
    expect(await signIn("old@example.test", { invite: "GDDDCDDE2345" })).toBe(true);
    expect((await db.inviteCode.findUnique({ where: { code: "GDDDCDDE2345" } }))?.usedCount).toBe(0);
    expect((await user("old@example.test"))?.hashedPassword).toBe("x");
  });

  it("signing in leaves an older account's missing terms alone", async () => {
    await createPracticeUser({ email: "old@example.test", name: "ותיק", hashedPassword: "x", emailVerified: true });
    await db.user.update({
      where: { email: "old@example.test" },
      data: { termsVersion: null, termsAcceptedAt: null },
    });
    expect(await signIn("old@example.test", { agreement: undefined })).toBe(true);
    expect((await user("old@example.test"))?.termsVersion).toBeNull();
  });

  it("Google verifies a waiting sign-up and drops the password nobody proved", async () => {
    await createPracticeUser({ email: "wait@example.test", name: "זר", hashedPassword: "strangers-hash" });
    await db.user.update({ where: { email: "wait@example.test" }, data: { emailVerifyTokenHash: "t" } });
    expect(await signIn("wait@example.test")).toBe(true);
    const u = await user("wait@example.test");
    expect(u?.emailVerifiedAt).toBeTruthy();
    expect(u?.hashedPassword).toBeNull();
    expect(u?.emailVerifyTokenHash).toBeNull();
    expect(u?.name).toBe("משתמש בדיקה");
  });

  it("the last use of a code goes to exactly one of many racing sign-ups", async () => {
    await invite({ code: "RACECDDE2345", maxUses: 3 });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        createPracticeUser({
          email: `race${i}@example.test`,
          name: "מרוץ",
          hashedPassword: null,
          inviteCode: "RACECDDE2345",
        }).then(
          () => "created",
          (e: Error) => e.constructor.name,
        ),
      ),
    );
    expect(results.filter((r) => r === "created")).toHaveLength(3);
    // Refused, or out of database connections under this load: never a fourth account
    expect(results.filter((r) => r !== "created")).toHaveLength(9);
    expect((await db.inviteCode.findUnique({ where: { code: "RACECDDE2345" } }))?.usedCount).toBe(3);
    expect(await db.user.count()).toBe(3);
  });

  it("a failed account creation gives the use back", async () => {
    await createPracticeUser({ email: "taken@example.test", name: "קיים", hashedPassword: null });
    await invite({ code: "GDDDCDDE2345" });
    await expect(
      createPracticeUser({ email: "taken@example.test", name: "כפול", hashedPassword: null, inviteCode: "GDDDCDDE2345" }),
    ).rejects.toThrow();
    expect((await db.inviteCode.findUnique({ where: { code: "GDDDCDDE2345" } }))?.usedCount).toBe(0);
  });
});
