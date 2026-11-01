-- Account closure: when the owner closed it, and when it is deleted for good.
-- Additive; every existing account stays open (both null).
ALTER TABLE "User" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "purgeAfter" TIMESTAMP(3);
CREATE INDEX "User_purgeAfter_idx" ON "User"("purgeAfter");
