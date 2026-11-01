-- First-run setup wizard state. Every account that exists today counts as
-- finished, so nobody already using the app is sent into the wizard; only
-- accounts created from now on start it. No existing data changes.
ALTER TABLE "User" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "onboardingPausedAt" TIMESTAMP(3);
UPDATE "User" SET "onboardingCompletedAt" = CURRENT_TIMESTAMP;
