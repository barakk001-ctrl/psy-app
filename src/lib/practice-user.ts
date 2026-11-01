import { db } from "@/lib/db";
import { claimInvite } from "@/lib/invite-store";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { TERMS_VERSION } from "@/lib/terms";
import { TRIAL_DAYS } from "@/lib/subscription";

/** The invite code ran out between the check and the sign-up. */
export class InviteUnavailable extends Error {}

/**
 * Creates a new practice owner — the one place users are created, for both
 * email/password registration and "המשך עם Google". Every new account starts
 * with the current agreement and terms accepted (the caller made sure they were) and a
 * TRIAL_DAYS trial; everything else takes the schema defaults.
 * `hashedPassword` is null for an account opened through Google, which is
 * also the only path passing `emailVerified`: Google proved the address, an
 * email sign-up still has to (src/lib/email-verification.ts).
 */
export async function createPracticeUser(input: {
  email: string;
  name: string;
  hashedPassword: string | null;
  emailVerified?: boolean;
  /** Uses this code up in the same transaction; refused with InviteUnavailable. */
  inviteCode?: string;
}) {
  const now = Date.now();
  const { inviteCode } = input;
  return db.$transaction(async (tx) => {
    const inviteCodeId = inviteCode ? await claimInvite(tx, inviteCode) : null;
    if (inviteCode && !inviteCodeId) throw new InviteUnavailable();
    return tx.user.create({
      data: {
        inviteCodeId,
        email: input.email.trim().toLowerCase(),
        name: input.name,
        hashedPassword: input.hashedPassword,
        emailVerifiedAt: input.emailVerified ? new Date(now) : null,
        agreementVersion: AGREEMENT_VERSION,
        agreementAcceptedAt: new Date(now),
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(now),
        trialEndsAt: new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, name: true },
    });
  });
}
