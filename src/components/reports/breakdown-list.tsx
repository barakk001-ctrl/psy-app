import { formatCurrency } from "@/lib/format";

export type BreakdownRow = {
  key: string;
  label: string;
  value: number;
  pct: number;
  href?: string;
};

export function BreakdownList({
  rows,
  emptyText,
}: {
  rows: BreakdownRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-ink-muted">{emptyText}</div>
    );
  }
  return (
    <ul className="divide-y divide-cream-200">
      {rows.map((row) => (
        <li key={row.key} className="px-5 py-3">
          <div className="flex items-center justify-between mb-1.5 text-sm">
            <span className="text-ink-soft truncate ms-2">{row.label}</span>
            <span className="text-ink font-medium shrink-0 tabular-nums">
              {formatCurrency(row.value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-500 rounded-full"
                style={{ width: `${Math.max(row.pct, 2)}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted shrink-0 w-10 text-end tabular-nums">
              {row.pct.toFixed(0)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
