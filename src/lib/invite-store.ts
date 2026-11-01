import { db, type DbTx } from "@/lib/db";
import { inviteUsable } from "@/lib/invite-codes";

/** Whether the code can be used right now. Doesn't use it up. */
export async function isInviteUsable(code: string): Promise<boolean> {
  const invite = await db.inviteCode.findUnique({
    where: { code },
    select: { usedCount: true, maxUses: true, expiresAt: true, revokedAt: true },
  });
  return !!invite && inviteUsable(invite, Date.now());
}

/**
 * Uses the code up by one, atomically: the conditions and the increment are
 * one statement, so two sign-ups can't share the last use. Returns its id, or
 * null when it can't be used. Call it in the transaction creating the account.
 */
export async function claimInvite(tx: DbTx, code: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "InviteCode" SET "usedCount" = "usedCount" + 1
    WHERE "code" = ${code}
      AND "revokedAt" IS NULL
      AND "usedCount" < "maxUses"
      AND ("expiresAt" IS NULL OR "expiresAt" > (now() AT TIME ZONE 'utc'))
    RETURNING "id"`;
  return rows[0]?.id ?? null;
}
