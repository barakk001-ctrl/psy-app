import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { fitCqi, splitZeroDecimals } from "@/lib/stat-value";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  const text = String(value);
  const split = splitZeroDecimals(text);
  // Phones show a whole-shekel amount without its ".00", so it gets its own,
  // usually larger, fit. See src/lib/stat-value.ts.
  const fitStyle = {
    "--stat-fit": `${fitCqi(split ? split.whole + split.suffix : text)}cqi`,
    "--stat-fit-sm": `${fitCqi(text)}cqi`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-cream-200/80 p-5 shadow-soft [container-type:inline-size]",
        "transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="absolute inset-y-4 end-0 w-1 rounded-s-full bg-gradient-to-b from-sage-300 to-sage-500" />
      <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div
        style={fitStyle}
        className="font-display text-ink mt-2 leading-none whitespace-nowrap text-[length:min(1.875rem,var(--stat-fit))] sm:text-[length:min(1.875rem,var(--stat-fit-sm))] lg:text-3xl lg:leading-none"
      >
        {split ? (
          <>
            <span className="sm:hidden">{split.whole + split.suffix}</span>
            <span className="hidden sm:inline">{text}</span>
          </>
        ) : (
          text
        )}
      </div>
      {hint && <div className="text-xs text-ink-subtle mt-2">{hint}</div>}
    </div>
  );
}
