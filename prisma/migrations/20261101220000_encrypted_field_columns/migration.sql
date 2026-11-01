-- Encrypted columns beside plain ones, expand-only: nothing is dropped or
-- converted here. See src/lib/sensitive-fields.ts.
ALTER TABLE "Client" ADD COLUMN "idNumberCiphertext" TEXT;
ALTER TABLE "Client" ADD COLUMN "generalNotesCiphertext" TEXT;
ALTER TABLE "SessionFile" ADD COLUMN "fileNameCiphertext" TEXT;
ALTER TABLE "InboxMessage" ADD COLUMN "textCiphertext" TEXT;
