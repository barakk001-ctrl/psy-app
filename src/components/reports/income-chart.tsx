import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function IncomeChart({
  data,
}: {
  data: { label: string; value: number; isPartial: boolean }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full">
      <div
        className="flex items-end gap-1 sm:gap-2 h-48 px-1"
        role="img"
        aria-label="הכנסות ב-12 החודשים האחרונים"
      >
        {data.map((d, i) => {
          const heightPct = (d.value / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end gap-1.5 group"
              title={`${d.label}: ${formatCurrency(d.value)}`}
            >
              {d.value > 0 && (
                <span className="text-[10px] text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {formatCurrency(d.value)}
                </span>
              )}
              <div
                className={cn(
                  "w-full rounded-t transition-colors",
                  d.isPartial
                    ? "bg-sage-300 group-hover:bg-sage-500"
                    : "bg-sage-500 group-hover:bg-sage-600",
                  d.value === 0 && "bg-cream-200 group-hover:bg-cream-300 h-1",
                )}
                style={{
                  height: d.value === 0 ? undefined : `${Math.max(heightPct, 2)}%`,
                  minHeight: d.value === 0 ? "4px" : "2px",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-1 sm:gap-2 mt-2 px-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] sm:text-xs text-ink-muted"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
