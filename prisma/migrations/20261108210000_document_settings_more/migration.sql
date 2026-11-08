-- Business details, look, email text and numbering for income documents
-- (Settings → הגדרות עסק / הגדרות מסמכים). Additive only: new nullable
-- columns, and defaults for the rest; no existing data changes.
ALTER TABLE "User"
  ADD COLUMN "occupation" TEXT,
  ADD COLUMN "businessDescription" TEXT,
  ADD COLUMN "docEmail" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "businessNameEn" TEXT,
  ADD COLUMN "addressEn" TEXT,
  ADD COLUMN "descriptionEn" TEXT,
  ADD COLUMN "signatureUrl" TEXT,
  ADD COLUMN "docTemplate" TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN "docColor" TEXT NOT NULL DEFAULT 'sage',
  ADD COLUMN "docEmailSubject" TEXT,
  ADD COLUMN "docEmailBody" TEXT,
  ADD COLUMN "docNextTaxInvoice" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "docNextTaxInvoiceReceipt" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "docNextReceipt" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "docNextCreditNote" INTEGER NOT NULL DEFAULT 1;
