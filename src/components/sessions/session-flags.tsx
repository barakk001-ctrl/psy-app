import { NotebookPen, Wallet, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bold at-a-glance flags for a meeting: was it documented, was the payment
 * updated. Rendered only for meetings that already started — a future meeting
 * is naturally neither.
 */
export function SessionFlags({
  documented,
  paymentDone,
  className,
}: {
  documented: boolean;
  paymentDone: boolean;
  className?: string;
}) {
  const flag = (done: boolean, Icon: typeof NotebookPen, label: string) => (
    <span
      title={done ? `${label} ✓` : `חסר ${label}`}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5",
        done
          ? "bg-sage-600 border-sage-600 text-cream-50"
          : "bg-terracotta-500/10 border-terracotta-500/40 text-terracotta-600",
      )}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {done ? (
        <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
      ) : (
        <X className="w-2.5 h-2.5" strokeWidth={3.5} />
      )}
    </span>
  );

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {flag(documented, NotebookPen, "תיעוד")}
      {flag(paymentDone, Wallet, "תשלום")}
    </span>
  );
}
