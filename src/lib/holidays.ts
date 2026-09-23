/** Israeli holidays for the calendar, from Hebcal (https://www.hebcal.com, data CC BY 4.0).
 *
 *  Only date ranges are sent — never anything about the practice or its clients.
 *  Fetched server-side and kept in memory for a day; if Hebcal cannot be reached
 *  the calendar simply shows no holidays rather than failing.
 */

export type HolidayMap = Record<string, string[]>; // yyyy-MM-dd → labels

type HebcalItem = {
  date?: string;
  category?: string;
  subcat?: string;
  hebrew?: string;
  title?: string;
};

// Entries Hebcal lists that are noise in a clinic calendar.
const SKIP = [/סליחות/, /שמירת בית הספר/, /פורים קטן/];

/** Hebcal's JSON → date → labels. Pure, so it can be tested without the network. */
export function parseHebcal(json: unknown): HolidayMap {
  const items = (json as { items?: HebcalItem[] })?.items;
  if (!Array.isArray(items)) return {};
  const out: HolidayMap = {};
  for (const it of items) {
    if (it.category !== "holiday" || !it.date) continue;
    const date = it.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    // "ראש השנה 5787" → "ראש השנה": the year number is clutter in a day cell
    const label = String(it.hebrew || it.title || "")
      .replace(/\s+\d{4}$/, "")
      .trim();
    if (!label || SKIP.some((re) => re.test(label))) continue;
    (out[date] ??= []).includes(label) || out[date].push(label);
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: HolidayMap }>();

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Holidays between two dates (inclusive). Never throws. */
export async function fetchHolidays(start: Date, end: Date): Promise<HolidayMap> {
  const key = `${ymd(start)}_${ymd(end)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY_MS) return hit.data;

  const url =
    "https://www.hebcal.com/hebcal?v=1&cfg=json&i=on&maj=on&min=on&mod=on" +
    "&nx=off&ss=off&mf=off&c=off&s=off&lg=he" +
    `&start=${ymd(start)}&end=${ymd(end)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store", // cached here instead, so page-level dynamic rendering can't defeat it
    });
    if (!res.ok) return hit?.data ?? {};
    const data = parseHebcal(await res.json());
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return hit?.data ?? {};
  }
}
