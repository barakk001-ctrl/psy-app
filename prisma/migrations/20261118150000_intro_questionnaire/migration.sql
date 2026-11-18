-- The "שאלון היכרות": a few optional answers about the practice itself.
-- Additive only: new nullable / defaulted columns on "User", nothing else.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "clinicType" TEXT,
ADD COLUMN     "dashboardFocus" TEXT,
ADD COLUMN     "introDoneAt" TIMESTAMP(3),
ADD COLUMN     "workingHours" JSONB;
