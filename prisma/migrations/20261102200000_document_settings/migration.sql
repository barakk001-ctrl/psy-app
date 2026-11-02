-- Per-document settings (language, VAT type, rounding) and their defaults.
-- Existing rows read as they did: Hebrew, VAT by business type, no rounding.
ALTER TABLE "Invoice" ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'he';
ALTER TABLE "Invoice" ADD COLUMN "vatType" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "rounding" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN "docCurrency" TEXT NOT NULL DEFAULT 'ILS';
ALTER TABLE "User" ADD COLUMN "docLang" TEXT NOT NULL DEFAULT 'he';
ALTER TABLE "User" ADD COLUMN "docVatType" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "docRounding" BOOLEAN NOT NULL DEFAULT false;
