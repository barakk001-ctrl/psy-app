-- One client status instead of two look-alikes: "archived" (מאוחסן) only ever
-- hid a client from lists — no data was hidden or deleted — so it is merged
-- into "inactive" (לא פעיל). Data-preserving: archived clients become
-- inactive; nothing else about any client, meeting or note changes.
UPDATE "Client" SET "status" = 'INACTIVE' WHERE "status" = 'ARCHIVED';

-- Drop the now-unused enum value (Postgres can't remove one in place).
-- Runs in the migration's single implicit transaction.
ALTER TYPE "ClientStatus" RENAME TO "ClientStatus_old";
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "Client" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "status" TYPE "ClientStatus" USING ("status"::text::"ClientStatus");
ALTER TABLE "Client" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "ClientStatus_old";
