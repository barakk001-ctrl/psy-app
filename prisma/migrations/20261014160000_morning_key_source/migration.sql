-- Where a practice's morning API keys came from (MANUAL today; PARTNER later). New column with a default only; existing connections become MANUAL, which is what they are.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "morningKeySource" TEXT NOT NULL DEFAULT 'MANUAL';

