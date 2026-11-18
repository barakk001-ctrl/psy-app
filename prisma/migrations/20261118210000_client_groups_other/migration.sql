-- The שאלון היכרות's second question ("במי מטפלים בעיקר") gets an "אחר" choice
-- with the practice's own words. (The new "הורים" choice needs no column: it is
-- one more id in "clientGroups".)
-- Additive only: one nullable column on "User"; null = no "אחר" answer.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientGroupsOther" TEXT;
