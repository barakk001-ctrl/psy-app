import { cn } from "@/lib/utils";
import { badgeText } from "@/lib/tasks";

/** The number of tasks due today or earlier, beside "משימות" in the menus; nothing at zero. */
export function TaskBadge({
  count,
  active,
  className,
}: {
  count: number;
  /** on the current page's (filled) menu item */
  active?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "min-w-[1.25rem] h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-medium leading-none tabular-nums",
        active ? "bg-cream-50 text-sage-700" : "bg-terracotta-600 text-cream-50",
        className,
      )}
    >
      <span aria-hidden>{badgeText(count)}</span>
      <span className="sr-only">{count === 1 ? "משימה אחת להיום" : `${count} משימות להיום`}</span>
    </span>
  );
}
