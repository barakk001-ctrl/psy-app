-- Tasks ("משימות"): the dashboard to-do list grows a client, a day, a note,
-- an encrypted title and who proposed it. Additive only: new nullable or
-- defaulted columns on "Todo", one index, one foreign key. Existing rows keep
-- their text and read as before.

-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "textCiphertext" TEXT,
ADD COLUMN     "noteCiphertext" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "dueDay" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "awaitingApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "doneAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Todo_clientId_idx" ON "Todo"("clientId");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
