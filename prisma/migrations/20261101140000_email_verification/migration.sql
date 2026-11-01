-- Email verification for new email/password sign-ups. Every account that
-- exists today counts as verified, so nobody already using the app is blocked;
-- only accounts created from now on have to confirm their address.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_emailVerifyTokenHash_key" ON "User"("emailVerifyTokenHash");
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP;
