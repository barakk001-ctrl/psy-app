-- Recycle bin for clients: a nullable timestamp, so every existing client
-- stays exactly as it is (NULL = not deleted). Nothing is rewritten or removed.
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- The purge looks up clients whose 30 days are over
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");
