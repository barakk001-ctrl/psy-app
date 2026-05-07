import { cn } from "@/lib/utils";

const LABELS = {
  DRAFT: "טיוטה",
  SENT: "נשלחה",
  PARTIALLY_PAID: "שולמה חלקית",
  PAID: "שולמה",
  CANCELLED: "מבוטלת",
} as const;

const STYLES = {
  DRAFT: "bg-cream-200 text-ink-muted",
  SENT: "bg-sage-100 text-sage-700",
  PARTIALLY_PAID: "bg-terracotta-500/10 text-terracotta-600",
  PAID: "bg-sage-600 text-cream-50",
  CANCELLED: "bg-cream-200 text-ink-subtle line-through decoration-1",
} as const;

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: keyof typeof LABELS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
