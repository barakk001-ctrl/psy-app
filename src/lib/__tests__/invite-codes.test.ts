import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  inviteExpiry,
  inviteLink,
  inviteStatus,
  inviteUsable,
  normalizeInviteCode,
} from "@/lib/invite-codes";
import { inviteCodeSchema } from "@/server/validators/invites";

const NOW = 1_800_000_000_000;
const generate = () => generateInviteCode(crypto.randomInt);
const base = { usedCount: 0, maxUses: 1, expiresAt: null, revokedAt: null };

describe("codes", () => {
  it("are long, random and read back as themselves", () => {
    const a = generate();
    expect(a).toHaveLength(INVITE_CODE_LENGTH);
    expect(a).not.toBe(generate());
    expect(normalizeInviteCode(a)).toBe(a);
  });

  it("avoid characters that are confused when read out", () => {
    for (let i = 0; i < 200; i++) expect(generate()).not.toMatch(/[01OIL]/);
  });

  it("accept what a person might type", () => {
    expect(normalizeInviteCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
  });

  it("the plain ?invite=1 link and junk are not codes", () => {
    for (const bad of ["1", "", "short", "ABCDEFGHJKM0", "ABCDEFGHJKMNP", null, undefined, 5, ["x"]]) {
      expect(normalizeInviteCode(bad)).toBeNull();
    }
  });

  it("the link holds the code in the address sign-up reads", () => {
    expect(inviteLink("https://mirpaa.app", "ABC")).toBe("https://mirpaa.app/register?invite=ABC");
  });
});

describe("inviteStatus", () => {
  it("a fresh code can be used", () => {
    expect(inviteStatus(base, NOW)).toBe("active");
    expect(inviteUsable(base, NOW)).toBe(true);
  });

  it("stops at maxUses", () => {
    expect(inviteUsable({ ...base, maxUses: 3, usedCount: 2 }, NOW)).toBe(true);
    expect(inviteStatus({ ...base, maxUses: 3, usedCount: 3 }, NOW)).toBe("used");
  });

  it("stops at the expiry", () => {
    expect(inviteUsable({ ...base, expiresAt: new Date(NOW + 1) }, NOW)).toBe(true);
    expect(inviteStatus({ ...base, expiresAt: new Date(NOW) }, NOW)).toBe("expired");
  });

  it("a revoked code never works, whatever else is true", () => {
    expect(inviteStatus({ ...base, revokedAt: new Date(NOW - 1) }, NOW)).toBe("revoked");
  });
});

describe("inviteExpiry", () => {
  it("0 means no expiry", () => {
    expect(inviteExpiry(0, NOW)).toBeNull();
    expect(inviteExpiry(null, NOW)).toBeNull();
    expect(inviteExpiry(7, NOW)?.getTime()).toBe(NOW + 7 * 24 * 60 * 60_000);
  });
});

describe("inviteCodeSchema", () => {
  const ok = { note: "", maxUses: "1", expiresInDays: "30" };

  it("takes the form's values", () => {
    expect(inviteCodeSchema.parse({ ...ok, note: " שם " })).toEqual({ note: "שם", maxUses: 1, expiresInDays: 30 });
  });

  it("refuses impossible use counts", () => {
    for (const maxUses of ["0", "-1", "1.5", "51", "x"]) {
      expect(inviteCodeSchema.safeParse({ ...ok, maxUses }).success).toBe(false);
    }
  });
});
