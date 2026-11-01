import { FAILURE_WINDOW_MS, isLocked, loginLockKey, loginPasswordKeys } from "@/lib/login-lockout";
import { clearBucket, hitBucket, peekBucket } from "@/lib/rate-limit";

export async function isLoginLocked(email: string): Promise<boolean> {
  return isLocked(await peekBucket(loginLockKey(email)), Date.now());
}

export async function recordLoginFailure(email: string): Promise<void> {
  await hitBucket(loginLockKey(email), FAILURE_WINDOW_MS);
}

/** After any successful sign-in or a password reset: the password works again at once. */
export async function clearLoginFailures(email: string): Promise<void> {
  await Promise.all(loginPasswordKeys(email).map(clearBucket));
}
