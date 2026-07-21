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
        "relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-cream-200/80 p-5 shadow-soft",
        "transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="absolute inset-y-4 end-0 w-1 rounded-s-full bg-gradient-to-b from-sage-300 to-sage-500" />
      <div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-display text-3xl text-ink mt-2 leading-none">{value}</div>
      {hint && <div className="text-xs text-ink-subtle mt-2">{hint}</div>}
    </div>
  );
}
