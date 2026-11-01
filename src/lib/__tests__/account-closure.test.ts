import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLOSE_CONFIRM_PHRASE,
  canRestore,
  closureDaysLeft,
  closureRefusal,
  confirmationMatches,
  isAccountPurgeDue,
  purgeDate,
} from "@/lib/account-closure";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-01T12:00:00Z");
const closed = (daysAgo: number) => {
  const closedAt = new Date(now.getTime() - daysAgo * DAY);
  return { closedAt, purgeAfter: purgeDate(closedAt), isAdmin: false };
};

describe("account closure rules", () => {
  it("takes the phrase, and only the phrase", () => {
    expect(confirmationMatches(CLOSE_CONFIRM_PHRASE)).toBe(true);
    expect(confirmationMatches("  סגירת   החשבון. ")).toBe(true);
    expect(confirmationMatches("סגירת")).toBe(false);
    expect(confirmationMatches("")).toBe(false);
  });

  it("an account is due only 30 days after its owner closed it", () => {
    expect(isAccountPurgeDue(closed(29), now)).toBe(false);
    expect(isAccountPurgeDue(closed(30), now)).toBe(true);
    expect(isAccountPurgeDue({ closedAt: null, purgeAfter: null, isAdmin: false }, now)).toBe(false);
    // dates alone aren't enough
    expect(isAccountPurgeDue({ closedAt: null, purgeAfter: new Date(0), isAdmin: false }, now)).toBe(false);
    expect(isAccountPurgeDue({ ...closed(90), isAdmin: true }, now)).toBe(false);
  });

  it("restoring ends where the purge begins", () => {
    expect(canRestore(closed(29), now)).toBe(true);
    expect(canRestore(closed(30), now)).toBe(false);
    expect(canRestore({ closedAt: null, purgeAfter: null }, now)).toBe(false);
  });

  it("counts the days left", () => {
    expect(closureDaysLeft(new Date(now.getTime() + 2.5 * DAY), now)).toBe(3);
    expect(closureDaysLeft(new Date(now.getTime() - DAY), now)).toBe(0);
  });

  it("refuses the operator and an account already closed", () => {
    expect(closureRefusal({ closedAt: null, isAdmin: false })).toBeNull();
    expect(closureRefusal({ closedAt: null, isAdmin: true })).toEqual(expect.any(String));
    expect(closureRefusal({ closedAt: now, isAdmin: false })).toEqual(expect.any(String));
  });
});

describe("closing stays deliberate", () => {
  const SRC = path.join(process.cwd(), "src");

  function sources(dir = SRC): { file: string; text: string }[] {
    const out: { file: string; text: string }[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") out.push(...sources(p));
      } else if (/\.tsx?$/.test(e.name)) {
        out.push({ file: path.relative(SRC, p).split(path.sep).join("/"), text: fs.readFileSync(p, "utf8") });
      }
    }
    return out;
  }

  it("only the owner's own action closes an account", () => {
    const callers = sources()
      .filter((s) => /\bcloseAccount\(/.test(s.text))
      .map((s) => s.file)
      .sort();
    expect(callers).toEqual(["lib/account-closure-data.ts", "server/actions/account.ts"]);
  });

  it("nothing else ever sets closedAt", () => {
    const writers = sources()
      .filter((s) => /closedAt:\s*(now|new Date|purge)/.test(s.text))
      .map((s) => s.file);
    expect(writers).toEqual(["lib/account-closure-data.ts"]);
  });

  it("every table holding a user id is cascaded or handled by the purge", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const purge = fs.readFileSync(path.join(SRC, "lib", "account-closure-data.ts"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
    const unhandled = models
      .filter(([, , body]) => /^\s+userId\s+String/m.test(body))
      .filter(([, , body]) => !/@relation\(fields: \[userId\][^)]*onDelete: Cascade/.test(body))
      .map(([, name]) => name)
      .filter((name) => !purge.includes(`tx.${name[0].toLowerCase()}${name.slice(1)}.`));
    expect(unhandled).toEqual([]);
  });
});
