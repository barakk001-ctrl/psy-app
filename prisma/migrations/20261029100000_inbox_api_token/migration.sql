-- The inbox API used the same token as the public appointment-request link,
-- so anyone holding a shared link could post to the API directly (and skip
-- the form's per-IP limit). Give the API its own token. The request link
-- (inboxToken) is untouched, so links already shared keep working; every
-- account that had one gets a fresh random API token (two UUIDv4s, 64 hex).
ALTER TABLE "User" ADD COLUMN "inboxApiToken" TEXT;
UPDATE "User"
SET "inboxApiToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "inboxToken" IS NOT NULL AND "inboxApiToken" IS NULL;
CREATE UNIQUE INDEX "User_inboxApiToken_key" ON "User"("inboxApiToken");
