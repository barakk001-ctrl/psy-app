import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 192;
const LABEL_SPACE = 34; // room above the bars for the two-line hover label

/**
 * Expected (the rates of the month's booked / held meetings) vs received, per
 * month on one shared scale: the pale bar is what the calendar promised, the
 * solid bar inside it is what actually came in.
 */
export function ExpectedVsReceivedChart({
  data,
}: {
  data: { label: string; value: number; expected: number; isPartial: boolean }[];
}) {
  const max = Math.max(...data.map((d) => Math.max(d.value, d.expected)), 1);
  const usable = CHART_HEIGHT - LABEL_SPACE;
  const h = (v: number) => (v > 0 ? Math.max((v / max) * usable, 4) : 0);
  const totalExpected = data.reduce((s, d) => s + d.expected, 0);
  const totalReceived = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted mb-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-cream-300 border border-cream-400" />
          צפוי לפי היומן
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sage-500" />
          התקבל בפועל
        </span>
        <span className="ms-auto tabular-nums">
          12 חודשים: התקבל {formatCurrency(totalReceived)} מתוך {formatCurrency(totalExpected)} צפוי
        </span>
      </div>
      <div
        className="flex items-end gap-1 sm:gap-2 px-1"
        style={{ height: `${CHART_HEIGHT}px` }}
        role="img"
        aria-label="הכנסה צפויה מול הכנסה בפועל, 12 החודשים האחרונים"
      >
        {data.map((d, i) => (
          <div
            key={i}
            tabIndex={0}
            className="flex-1 h-full flex flex-col items-center justify-end group min-w-0 outline-none"
            title={`${d.label} — צפוי ${formatCurrency(d.expected)} · התקבל ${formatCurrency(d.value)}`}
          >
            <span
              className={cn(
                "text-[10px] leading-tight text-ink-muted whitespace-nowrap text-center mb-1",
                "opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity",
              )}
            >
              {formatCurrency(d.value)}
              <br />
              <span className="text-ink-subtle">מתוך {formatCurrency(d.expected)}</span>
            </span>
            <div
              className="relative w-full flex items-end justify-center"
              style={{ height: `${Math.max(h(d.expected), h(d.value), 2)}px` }}
            >
              {/* Expected: the pale full-width bar */}
              <div
                className={cn(
                  "absolute bottom-0 inset-x-0 rounded-t border border-b-0 border-cream-400 bg-cream-300/80",
                  d.expected === 0 && "border-0 bg-cream-200",
                )}
                style={{ height: `${Math.max(h(d.expected), 2)}px` }}
              />
              {/* Received: the solid narrower bar in front */}
              {d.value > 0 && (
                <div
                  className={cn(
                    "relative w-3/5 rounded-t ring-2 ring-white/80",
                    d.isPartial ? "bg-sage-300" : "bg-sage-500 group-hover:bg-sage-600",
                  )}
                  style={{ height: `${h(d.value)}px` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1 sm:gap-2 mt-2 px-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] sm:text-xs text-ink-muted">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
