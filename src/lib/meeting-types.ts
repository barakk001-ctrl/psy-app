import { db } from "@/lib/db";

export const DEFAULT_MEETING_TYPES = [
  "טיפול פרטני",
  "טיפול קבוצתי",
  "הדרכת הורים",
  "ייעוץ",
  "אבחון",
];

/** The rows to create when someone adds a meeting type.
 *
 *  `getMeetingTypeNames` falls back to the defaults only while a user has none
 *  of their own, so adding the first custom type used to REPLACE the list rather
 *  than extend it: add "ייעוץ" and the other four silently disappear from
 *  every form. The first add therefore materialises the defaults alongside the
 *  new name, and anything unwanted can then be removed deliberately.
 */
export function typesToCreate(existing: string[], added: string): string[] {
  const name = added.trim();
  const seeding = existing.length === 0;
  const out = seeding ? [...DEFAULT_MEETING_TYPES] : [];
  if (name && !out.includes(name) && !existing.includes(name)) out.push(name);
  return out;
}

/** The user's meeting-type labels for form selects (defaults when none defined). */
export async function getMeetingTypeNames(userId: string): Promise<string[]> {
  const types = await db.meetingType.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return types.length > 0 ? types.map((t) => t.name) : DEFAULT_MEETING_TYPES;
}

/** Meeting-type label → calendar color, for types that have one assigned. */
export async function getMeetingTypeColorMap(
  userId: string,
): Promise<Record<string, string>> {
  const types = await db.meetingType.findMany({
    where: { userId, color: { not: null } },
    select: { name: true, color: true },
  });
  return Object.fromEntries(types.map((t) => [t.name, t.color!]));
}
