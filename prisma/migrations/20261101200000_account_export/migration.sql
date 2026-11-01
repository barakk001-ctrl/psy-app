-- Full account export: a one-time grant for the download. Additive.
ALTER TABLE "User" ADD COLUMN "exportGrantHash" TEXT;
ALTER TABLE "User" ADD COLUMN "exportGrantExpiresAt" TIMESTAMP(3);
