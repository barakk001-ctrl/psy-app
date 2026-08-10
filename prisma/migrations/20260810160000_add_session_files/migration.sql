-- CreateTable
CREATE TABLE "SessionFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "dataCiphertext" BYTEA NOT NULL,
    "dataIv" TEXT NOT NULL,
    "dataTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionFile_sessionId_idx" ON "SessionFile"("sessionId");

-- CreateIndex
CREATE INDEX "SessionFile_clientId_createdAt_idx" ON "SessionFile"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "SessionFile" ADD CONSTRAINT "SessionFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFile" ADD CONSTRAINT "SessionFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFile" ADD CONSTRAINT "SessionFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

