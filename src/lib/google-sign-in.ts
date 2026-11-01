import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { clientIpFrom } from "@/lib/client-ip";
import { googleVerifiedUpdate } from "@/lib/email-verification";
import { decideGoogleSignIn, displayNameFor, normalizeEmail } from "@/lib/google-auth";
import { normalizeInviteCode } from "@/lib/invite-codes";
import { isInviteUsable } from "@/lib/invite-store";
import { clearLoginFailures } from "@/lib/login-lockout-store";
import { InviteUnavailable, createPracticeUser } from "@/lib/practice-user";
import { rateLimit } from "@/lib/rate-limit";
import { canCreateAccount } from "@/lib/signup-policy";

/**
 * The Auth.js `signIn` callback for Google: true to go on, or the page to send
 * the visitor to. Everything it reads from the request comes in as arguments,
 * so it is tested on a real database (google-sign-in.db.test.ts) without Google.
 */
export async function googleSignIn(input: {
  profile: { email?: string | null; email_verified?: unknown; name?: string | null } | undefined;
  /** The value of the agreement cookie */
  agreement: string | undefined;
  /** The value of the invite cookie */
  invite: string | undefined;
  headers: { get(name: string): string | null };
}): Promise<true | string> {
  const { profile } = input;
  const email = profile?.email ? normalizeEmail(profile.email) : null;
  const existing = email
    ? await db.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } })
    : null;
  const onList = !!email && canCreateAccount(email);
  // Only a new address needs one, and a listed address doesn't use one up
  const inviteCode = existing || onList ? null : normalizeInviteCode(input.invite);

  const decision = decideGoogleSignIn({
    email,
    emailVerified: profile?.email_verified,
    googleName: profile?.name,
    existingUserId: existing?.id ?? null,
    agreementAccepted: input.agreement === AGREEMENT_VERSION,
    // The invitation list applies only to creating an account
    creationAllowed: onList || (!!inviteCode && (await isInviteUsable(inviteCode))),
  });

  switch (decision.type) {
    case "reject":
      return "/login?error=google_unverified";
    case "need-agreement":
      return `/register?invite=${inviteCode ?? "1"}&google=agreement`;
    case "not-invited":
      return "/register?google=not-invited";
    case "link":
      // A sign-up still waiting for its link: Google has now proven the address
      if (!existing?.emailVerifiedAt) {
        await db.user.update({
          where: { id: decision.userId },
          data: googleVerifiedUpdate(new Date(), displayNameFor(profile?.name, email ?? "")),
        });
      }
      if (email) await clearLoginFailures(email);
      return true;
    case "create": {
      const ip = clientIpFrom(input.headers);
      if (!(await rateLimit(`register:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 })).allowed) {
        return "/register?error=rate";
      }
      try {
        await createPracticeUser({
          email: decision.email,
          name: decision.name,
          hashedPassword: null,
          emailVerified: true,
          inviteCode: inviteCode ?? undefined,
        });
      } catch (err) {
        if (err instanceof InviteUnavailable) return "/register?google=not-invited";
        // Two tabs racing: the email is unique, so the other one won — sign
        // in to that account rather than failing.
        const raced = await db.user.findUnique({ where: { email: decision.email }, select: { id: true } });
        if (!raced) throw err;
      }
      return true;
    }
  }
}
