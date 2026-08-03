-- CreateEnum
CREATE TYPE "TreatmentType" AS ENUM ('INDIVIDUAL', 'GROUP', 'PARENT_GUIDANCE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "treatmentType" "TreatmentType" NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "treatmentType" "TreatmentType" NOT NULL DEFAULT 'INDIVIDUAL';

