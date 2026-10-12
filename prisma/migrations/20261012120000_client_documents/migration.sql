-- Client documents ("מסמכים" on the client card) + AuditLog.documentId. New tables and a new nullable column only; no existing data is touched.
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "documentId" TEXT;

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nameCiphertext" TEXT NOT NULL,
    "descriptionCiphertext" TEXT,
    "category" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocumentBlob" (
    "documentId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ClientDocumentBlob_pkey" PRIMARY KEY ("documentId")
);

-- CreateIndex
CREATE INDEX "ClientDocument_userId_clientId_createdAt_idx" ON "ClientDocument"("userId", "clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocumentBlob" ADD CONSTRAINT "ClientDocumentBlob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

