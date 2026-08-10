import { db } from "@/lib/db";

export const DEFAULT_MEETING_TYPES = [
  "טיפול פרטני",
  "טיפול קבוצתי",
  "הדרכת הורים",
  "אבחון",
];

/** The user's meeting-type labels for form selects (defaults when none defined). */
export async function getMeetingTypeNames(userId: string): Promise<string[]> {
  const types = await db.meetingType.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return types.length > 0 ? types.map((t) => t.name) : DEFAULT_MEETING_TYPES;
}
