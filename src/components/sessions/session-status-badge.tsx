import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  SCHEDULED: "מתוכננת",
  COMPLETED: "התקיימה",
  CANCELLED: "בוטלה",
  NO_SHOW: "לא הופיע/ה",
} as const;

const STATUS_STYLES = {
  SCHEDULED: "bg-sage-100 text-sage-700",
  COMPLETED: "bg-cream-200 text-ink-soft",
  CANCELLED: "bg-cream-200 text-ink-subtle line-through decoration-1",
  NO_SHOW: "bg-terracotta-500/10 text-terracotta-600",
} as const;

export function SessionStatusBadge({
  status,
  className,
}: {
  status: keyof typeof STATUS_LABELS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
