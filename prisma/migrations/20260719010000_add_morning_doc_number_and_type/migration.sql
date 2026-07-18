-- AlterTable
ALTER TABLE "User" ADD COLUMN     "morningDocType" INTEGER NOT NULL DEFAULT 400;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "morningDocNumber" TEXT;

