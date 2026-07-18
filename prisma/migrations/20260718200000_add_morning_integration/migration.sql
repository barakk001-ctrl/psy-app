-- AlterTable
ALTER TABLE "User" ADD COLUMN     "morningApiKeyId" TEXT,
ADD COLUMN     "morningApiSecret" TEXT,
ADD COLUMN     "morningSandbox" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "morningDocId" TEXT,
ADD COLUMN     "morningDocUrl" TEXT;

