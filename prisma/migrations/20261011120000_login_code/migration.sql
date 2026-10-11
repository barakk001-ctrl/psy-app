-- Sign-in with a one-time code (email now, SMS later). Additive only.
ALTER TABLE "User" ADD COLUMN "loginCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "loginCodeExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "loginCodeAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "loginPhone" TEXT;
