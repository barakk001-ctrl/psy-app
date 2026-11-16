import { cn } from "@/lib/utils";

/** A quiet initial in a small circle beside the dashboard's "שלום, …" while
 *  the practice has no logo of its own. Once one is uploaded it takes the
 *  hero's large spot (hero-logo.tsx) and the app's mark stands here instead. */
export function LogoAvatar({ name, className }: { name?: string | null; className?: string }) {
  const initial = name?.trim()[0];
  if (!initial) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-full shrink-0 ring-2 ring-white shadow-soft w-11 h-11 sm:w-12 sm:h-12",
        "grid place-items-center bg-sage-100 text-sage-700 font-display text-lg sm:text-xl",
        className,
      )}
    >
      {initial}
    </span>
  );
}
