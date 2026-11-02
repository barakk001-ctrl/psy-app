-- A document can be for a one-off client (no Client row), and carries its
-- currency and the meetings ticked on it before issuing. Existing rows keep
-- their client and read as ILS.
ALTER TABLE "Invoice" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ILS';
ALTER TABLE "Invoice" ADD COLUMN "draftSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "InvoiceItem" ADD COLUMN "linkOnly" BOOLEAN NOT NULL DEFAULT false;
