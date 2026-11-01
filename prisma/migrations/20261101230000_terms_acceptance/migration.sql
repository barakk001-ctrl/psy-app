-- Terms of service accepted at sign-up. New nullable columns, no backfill:
-- older accounts stay empty and are not asked again.
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
