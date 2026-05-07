import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "rounded-lg bg-white border border-cream-300 p-5 shadow-soft",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-display text-3xl text-ink mt-2 leading-none">{value}</div>
      {hint && <div className="text-xs text-ink-subtle mt-2">{hint}</div>}
    </div>
  );
}
