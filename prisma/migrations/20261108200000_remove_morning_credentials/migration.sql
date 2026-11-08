-- morning (Green Invoice) was removed from the app on 2026-11-08: nothing calls
-- its API any more, so the stored API credentials are only risk. Clear them
-- first (explicitly, so the intent survives in the history), then drop the
-- columns that existed only for the connection.
--
-- Kept on purpose (history): the morning document ids/numbers/links on
-- "Invoice" and "Session", "Invoice"."morningIssuedAt", the "MorningDocument"
-- table, and "User"."morningDocType" (now the default document type, mapped
-- as defaultDocType).
UPDATE "User"
SET "morningApiKeyId" = NULL, "morningApiSecret" = NULL
WHERE "morningApiKeyId" IS NOT NULL OR "morningApiSecret" IS NOT NULL;

ALTER TABLE "User"
  DROP COLUMN "morningApiKeyId",
  DROP COLUMN "morningApiSecret",
  DROP COLUMN "morningSandbox",
  DROP COLUMN "morningKeySource";
