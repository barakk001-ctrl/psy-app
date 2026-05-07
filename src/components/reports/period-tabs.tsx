import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS, type PeriodKey } from "@/lib/reports";

export function PeriodTabs({ active }: { active: PeriodKey }) {
  return (
    <div
      className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1"
      role="tablist"
    >
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={p.key === "this-month" ? "/reports" : `/reports?period=${p.key}`}
          role="tab"
          aria-selected={active === p.key}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            active === p.key
              ? "bg-white text-ink shadow-soft"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
