-- Convert treatmentType enum columns to free-text labels IN PLACE (no data loss)
ALTER TABLE "Client" ALTER COLUMN "treatmentType" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "treatmentType" TYPE TEXT USING (
  CASE "treatmentType"::text
    WHEN 'INDIVIDUAL' THEN 'טיפול פרטני'
    WHEN 'GROUP' THEN 'טיפול קבוצתי'
    WHEN 'PARENT_GUIDANCE' THEN 'הדרכת הורים'
    WHEN 'ASSESSMENT' THEN 'אבחון'
    ELSE 'טיפול פרטני'
  END
);
ALTER TABLE "Client" ALTER COLUMN "treatmentType" SET DEFAULT 'טיפול פרטני';

ALTER TABLE "Session" ALTER COLUMN "treatmentType" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "treatmentType" TYPE TEXT USING (
  CASE "treatmentType"::text
    WHEN 'INDIVIDUAL' THEN 'טיפול פרטני'
    WHEN 'GROUP' THEN 'טיפול קבוצתי'
    WHEN 'PARENT_GUIDANCE' THEN 'הדרכת הורים'
    WHEN 'ASSESSMENT' THEN 'אבחון'
    ELSE 'טיפול פרטני'
  END
);
ALTER TABLE "Session" ALTER COLUMN "treatmentType" SET DEFAULT 'טיפול פרטני';

-- DropEnum
DROP TYPE "TreatmentType";

-- CreateTable
CREATE TABLE "MeetingType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeetingType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingType_userId_name_key" ON "MeetingType"("userId", "name");

-- AddForeignKey
ALTER TABLE "MeetingType" ADD CONSTRAINT "MeetingType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the built-in types for existing users
INSERT INTO "MeetingType" ("id", "userId", "name", "position")
SELECT gen_random_uuid()::text, u."id", t.name, t.pos
FROM "User" u
CROSS JOIN (VALUES ('טיפול פרטני', 0), ('טיפול קבוצתי', 1), ('הדרכת הורים', 2), ('אבחון', 3)) AS t(name, pos);
