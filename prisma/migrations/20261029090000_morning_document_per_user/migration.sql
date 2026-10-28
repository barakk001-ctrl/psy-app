-- MorningDocument was keyed by morning's document id alone, so a second
-- account syncing the same morning document would update the first account's
-- row. Keep every row and its id; add morning's id as its own column, unique
-- per account. Nothing is deleted or rewritten except the new column's copy.
ALTER TABLE "MorningDocument" ADD COLUMN "morningId" TEXT;
UPDATE "MorningDocument" SET "morningId" = "id" WHERE "morningId" IS NULL;
ALTER TABLE "MorningDocument" ALTER COLUMN "morningId" SET NOT NULL;
CREATE UNIQUE INDEX "MorningDocument_userId_morningId_key" ON "MorningDocument"("userId", "morningId");
