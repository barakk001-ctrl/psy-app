import { db } from "@/lib/db";
import { checkLoginCode, issueLoginCode, type StoredLoginCode } from "@/lib/login-code";

// DB side of the one-time sign-in code (rules in login-code.ts).

function codeSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function columns(s: StoredLoginCode) {
  return { loginCodeHash: s.hash, loginCodeExpiresAt: s.expiresAt, loginCodeAttempts: s.attempts };
}

/** Creates a fresh code for the account (any earlier one stops working) and returns its digits. */
export async function createLoginCode(userId: string): Promise<string> {
  const { code, stored } = issueLoginCode(userId, codeSecret(), Date.now());
  await db.user.update({ where: { id: userId }, data: columns(stored) });
  return code;
}

/**
 * Checks a typed code and spends it. True only for the right, unexpired code,
 * and only once: the write is conditional on the code it read, so two
 * requests racing with the same code can't both get in.
 */
export async function consumeLoginCode(userId: string, input: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { loginCodeHash: true, loginCodeExpiresAt: true, loginCodeAttempts: true },
  });
  if (!user?.loginCodeHash) return false;

  const stored: StoredLoginCode = {
    hash: user.loginCodeHash,
    expiresAt: user.loginCodeExpiresAt,
    attempts: user.loginCodeAttempts,
  };
  const result = checkLoginCode(stored, input, { userId, secret: codeSecret(), now: Date.now() });
  const written = await db.user.updateMany({
    where: { id: userId, loginCodeHash: stored.hash, loginCodeAttempts: stored.attempts },
    data: columns(result.next),
  });
  return result.ok && written.count === 1;
}
