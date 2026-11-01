import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { TRIAL_DAYS } from "@/lib/subscription";

/**
 * Creates a new practice owner — the one place users are created, for both
 * email/password registration and "המשך עם Google". Every new account starts
 * with the current agreement accepted (the caller made sure it was) and a
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
}) {
  const now = Date.now();
  return db.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name,
      hashedPassword: input.hashedPassword,
      emailVerifiedAt: input.emailVerified ? new Date(now) : null,
      agreementVersion: AGREEMENT_VERSION,
      agreementAcceptedAt: new Date(now),
      trialEndsAt: new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
    select: { id: true, email: true, name: true },
  });
}
