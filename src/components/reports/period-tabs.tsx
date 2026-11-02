import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS, type PeriodKey } from "@/lib/reports";

/** Five equal columns with a thin line between them, none beside the selected pill. */
export function PeriodTabs({ active }: { active: PeriodKey }) {
  return (
    <div
      className="grid grid-cols-5 w-full sm:max-w-xl bg-cream-100 border border-cream-300 rounded-full p-1"
      role="tablist"
    >
      {PERIODS.map((p, i) => {
        const line = i > 0 && active !== p.key && active !== PERIODS[i - 1].key;
        return (
          <div
            key={p.key}
            role="presentation"
            className={cn("flex border-s", line ? "border-cream-300" : "border-transparent")}
          >
            <Link
              href={p.key === "this-month" ? "/reports" : `/reports?period=${p.key}`}
              role="tab"
              aria-selected={active === p.key}
              className={cn(
                "flex-1 flex items-center justify-center text-center leading-tight",
                "px-1 py-1.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors",
                active === p.key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
