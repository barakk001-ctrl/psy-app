import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { hashBackupCode, looksLikeBackupCode, verifyTotp } from "@/lib/totp";

/**
 * Checks a login's second factor: a valid rotating code, or an unused one-time
 * backup code (consumed on success). Shared by the password login and the
 * Google sign-in's /login/two-factor step. Never throws — false on any error.
 */
export async function verifySecondFactor(
  user: { id: string; totpSecret: string | null; totpBackupCodes: string | null },
  input: string,
): Promise<boolean> {
  if (!user.totpSecret) return false;
  try {
    if (looksLikeBackupCode(input)) {
      const hashes: string[] = user.totpBackupCodes ? JSON.parse(user.totpBackupCodes) : [];
      const hash = hashBackupCode(input);
      if (!hashes.includes(hash)) return false;
      // Consume: a backup code works exactly once
      await db.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: JSON.stringify(hashes.filter((h) => h !== hash)) },
      });
      return true;
    }
    return verifyTotp(decryptSecret(user.totpSecret), input);
  } catch {
    return false;
  }
}
