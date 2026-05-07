const TZ = "Asia/Jerusalem";

export function formatCurrency(amount: number | string | null | undefined, currency = "ILS") {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(n);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: TZ }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(d);
}

export function formatTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("he-IL", { timeStyle: "short", timeZone: TZ }).format(d);
}
