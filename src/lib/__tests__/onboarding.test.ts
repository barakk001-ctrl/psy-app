import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAST_STEP, SETUP_STEPS, clampStep, shouldEnterSetup, stepToOpen } from "@/lib/onboarding";

const fresh = { onboardingCompletedAt: null, onboardingPausedAt: null };
const when = new Date("2026-11-01");

describe("who goes through the setup wizard", () => {
  it("a new account does, on a trial or a paid plan", () => {
    expect(shouldEnterSetup(fresh, "trial")).toBe(true);
    expect(shouldEnterSetup(fresh, "active")).toBe(true);
  });
  it("a finished account never does (existing accounts are marked finished)", () => {
    expect(shouldEnterSetup({ ...fresh, onboardingCompletedAt: when }, "trial")).toBe(false);
    expect(shouldEnterSetup({ ...fresh, onboardingCompletedAt: when }, "exempt")).toBe(false);
  });
  it("someone who chose to finish later isn't pushed back in", () => {
    expect(shouldEnterSetup({ ...fresh, onboardingPausedAt: when }, "trial")).toBe(false);
  });
  it("an expired account isn't sent there: it is read-only", () => {
    expect(shouldEnterSetup(fresh, "expired")).toBe(false);
  });
  it("the migration marks every existing account finished, and changes nothing else", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20261101120000_onboarding/migration.sql"), "utf8");
    expect(sql).toMatch(/UPDATE "User" SET "onboardingCompletedAt" = CURRENT_TIMESTAMP;/);
    expect(sql).not.toMatch(/DROP|DELETE/);
  });
});

describe("which step opens", () => {
  it("resumes where they stopped", () => {
    expect(stepToOpen(undefined, 2)).toBe(2);
    expect(stepToOpen(undefined, 0)).toBe(0);
  });
  it("the URL (1-based) wins, within range", () => {
    expect(stepToOpen("1", 3)).toBe(0);
    expect(stepToOpen("3", 0)).toBe(2);
    expect(stepToOpen("99", 0)).toBe(LAST_STEP);
    expect(stepToOpen("abc", 2)).toBe(2);
  });
  it("clamps stored values", () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(50)).toBe(LAST_STEP);
    expect(clampStep(1.5)).toBe(0);
  });
  it("ends on the ready screen", () => {
    expect(SETUP_STEPS[LAST_STEP].id).toBe("done");
  });
});
