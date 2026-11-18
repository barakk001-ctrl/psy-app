-- The therapist's word for the people they treat (the שאלון היכרות's seventh
-- question): לקוחות / מטופלים / נועצים.
-- Additive only: one nullable column on "User"; null = "לקוחות", as before.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientWord" TEXT;
