-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "morningReceiptNumber" TEXT,
ADD COLUMN     "morningReceiptUrl" TEXT,
ADD COLUMN     "paidAmount" DECIMAL(10,2),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentStatus" TEXT;

