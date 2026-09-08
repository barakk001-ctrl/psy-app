-- AlterTable: click-acceptance record for the data-holding agreement
ALTER TABLE "User" ADD COLUMN "agreementVersion" TEXT,
ADD COLUMN "agreementAcceptedAt" TIMESTAMP(3);
