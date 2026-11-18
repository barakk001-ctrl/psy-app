// The price a new meeting gets, and what the form shows before one is typed.
// Order: what was typed in the meeting's form, else the client's own rate
// (the client's card), else the practice's usual rate ("תעריף ברירת מחדל
// לפגישה" in Settings and in the שאלון היכרות). 0 is a price — a meeting at no
// charge — at every level, so it never falls through to the next one.
//
// Only for a NEW meeting: editing one saves exactly what its form holds, and a
// recurring series copies the price of the meeting it grew from.

type Rate = number | string | null | undefined;

const asNumber = (v: Rate): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function newSessionRate(typed: Rate, clientRate: Rate, practiceRate: Rate): number | null {
  return asNumber(typed) ?? asNumber(clientRate) ?? asNumber(practiceRate);
}

/** The rate an empty price field will be saved with, as text for the form's hint ("" = none). */
export function fallbackRateText(clientRate: Rate, practiceRate: Rate): string {
  const n = newSessionRate(null, clientRate, practiceRate);
  return n === null ? "" : String(n);
}
