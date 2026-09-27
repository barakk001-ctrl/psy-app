import { cn } from "@/lib/utils";

/** The practice's logo in a small circle beside the "שלום, …" greeting. With
 *  no logo set it falls back to a quiet initial, so the greeting never jumps. */
export function LogoAvatar({
  logoUrl,
  name,
  className,
}: {
  logoUrl?: string | null;
  name?: string | null;
  className?: string;
}) {
  const base = cn(
    "rounded-full shrink-0 ring-2 ring-white shadow-soft w-11 h-11 sm:w-12 sm:h-12",
    className,
  );
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
      <img src={logoUrl} alt="" aria-hidden className={cn(base, "object-cover bg-white")} />
    );
  }
  const initial = name?.trim()[0];
  if (!initial) return null;
  return (
    <span
      aria-hidden
      className={cn(
        base,
        "grid place-items-center bg-sage-100 text-sage-700 font-display text-lg sm:text-xl",
      )}
    >
      {initial}
    </span>
  );
}
