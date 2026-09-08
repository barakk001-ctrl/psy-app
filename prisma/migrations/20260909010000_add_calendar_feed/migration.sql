-- AlterTable: private ICS calendar feed token + client-name privacy mode
ALTER TABLE "User" ADD COLUMN "calendarToken" TEXT,
ADD COLUMN "calendarNameMode" TEXT NOT NULL DEFAULT 'FIRST';

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
