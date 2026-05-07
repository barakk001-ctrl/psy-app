import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 192; // h-48 in pixels — used so we can give bars px heights

export function IncomeChart({
  data,
}: {
  data: { label: string; value: number; isPartial: boolean }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full">
      <div
        className="flex items-end gap-1 sm:gap-2 px-1"
        style={{ height: `${CHART_HEIGHT}px` }}
        role="img"
        aria-label="הכנסות ב-12 החודשים האחרונים"
      >
        {data.map((d, i) => {
          // Reserve 18px at the top of each column for the hover label.
          const usableHeight = CHART_HEIGHT - 18;
          const barHeight =
            d.value > 0 ? Math.max((d.value / max) * usableHeight, 4) : 2;
          return (
            <div
              key={i}
              className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group min-w-0"
              title={`${d.label}: ${formatCurrency(d.value)}`}
            >
              <span
                className={cn(
                  "text-[10px] text-ink-muted whitespace-nowrap transition-opacity",
                  d.value > 0
                    ? "opacity-0 group-hover:opacity-100"
                    : "opacity-0",
                )}
              >
                {formatCurrency(d.value)}
              </span>
              <div
                className={cn(
                  "w-full rounded-t transition-colors",
                  d.value === 0
                    ? "bg-cream-200 group-hover:bg-cream-300"
                    : d.isPartial
                      ? "bg-sage-300 group-hover:bg-sage-500"
                      : "bg-sage-500 group-hover:bg-sage-600",
                )}
                style={{ height: `${barHeight}px` }}
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
