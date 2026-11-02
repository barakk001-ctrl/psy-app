-- Expense documents: an uploaded file, encrypted, and the details typed for it.
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "docType" INTEGER,
    "docDate" TIMESTAMP(3),
    "supplier" TEXT,
    "docNumber" TEXT,
    "amount" DECIMAL(10,2),
    "vatAmount" DECIMAL(10,2),
    "nameCiphertext" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseBlob" (
    "expenseId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ExpenseBlob_pkey" PRIMARY KEY ("expenseId")
);

CREATE INDEX "Expense_userId_status_docDate_idx" ON "Expense"("userId", "status", "docDate");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseBlob" ADD CONSTRAINT "ExpenseBlob_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
