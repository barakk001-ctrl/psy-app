-- More receipt-line payment types (Payoneer, Google Pay, Apple Pay, gift
-- voucher). Adding enum values only: every existing row keeps its value.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYONEER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GOOGLE_PAY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'APPLE_PAY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GIFT_VOUCHER';
