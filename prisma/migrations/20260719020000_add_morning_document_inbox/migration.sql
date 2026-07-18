-- CreateTable
CREATE TABLE "MorningDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" TEXT,
    "docType" INTEGER,
    "docDate" TIMESTAMP(3),
    "amount" DECIMAL(10,2),
    "description" TEXT,
    "morningClientName" TEXT,
    "url" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MorningDocument_userId_clientId_idx" ON "MorningDocument"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "MorningDocument" ADD CONSTRAINT "MorningDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningDocument" ADD CONSTRAINT "MorningDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

