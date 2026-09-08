-- AlterTable: trial + subscription state, operator flags
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "subscriptionPlan" TEXT,
ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN "subscriptionExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Accounts that exist before the subscription feature are the operators
-- (the practitioner-owner and the developer) — exempt and admin.
UPDATE "User" SET "subscriptionExempt" = true, "isAdmin" = true;
