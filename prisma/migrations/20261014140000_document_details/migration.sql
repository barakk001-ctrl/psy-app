-- "מסמך חדש" in morning's terms: document type, VAT mode, client details on the document, receipt-line details, and the PayBox payment method. New nullable columns / defaults and a new enum value only; no existing data is changed.
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYBOX';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "description" TEXT,
ADD COLUMN     "docClientEmail" TEXT,
ADD COLUMN     "docClientName" TEXT,
ADD COLUMN     "docClientTaxId" TEXT,
ADD COLUMN     "docType" INTEGER,
ADD COLUMN     "morningIssuedAt" TIMESTAMP(3),
ADD COLUMN     "relatedInvoiceId" TEXT,
ADD COLUMN     "vatIncluded" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "cardType" TEXT,
ADD COLUMN     "chequeNumber" TEXT,
ADD COLUMN     "dealType" TEXT,
ADD COLUMN     "installments" INTEGER;

