-- AlterTable: combined tax invoice-receipt (חשבונית מס-קבלה) issued in Morning
ALTER TABLE "Session" ADD COLUMN     "morningInvoiceReceiptNumber" TEXT,
ADD COLUMN     "morningInvoiceReceiptUrl" TEXT;

-- AlterTable: per-type calendar color
ALTER TABLE "MeetingType" ADD COLUMN     "color" TEXT;
