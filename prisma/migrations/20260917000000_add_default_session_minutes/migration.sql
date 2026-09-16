-- AlterTable: per-practitioner default meeting length, in minutes.
-- 50 keeps every existing practice on the length the form used to hard-code,
-- so no one's habit changes when this ships.
ALTER TABLE "User" ADD COLUMN "defaultSessionMinutes" INTEGER NOT NULL DEFAULT 50;
