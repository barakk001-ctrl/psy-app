import { cn } from "@/lib/utils";

/**
 * The practice's own logo in the large spot of the dashboard hero and the
 * page banner (the app's illustration sits there until a logo is uploaded).
 *
 * The whole picture, never cut or stretched: it takes its own proportions and
 * shrinks to fit the box its parent gives it (a flex box of a known height).
 * It is never drawn larger than the stored thumbnail, so a small upload stays
 * sharp instead of being blown up. The white mat makes any file read as
 * deliberate: a white background blends into it, a dark one is framed by it,
 * and a see-through logo gets a clean ground instead of the hero's gradient.
 */
export function HeroLogo({ logoUrl, className }: { logoUrl: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
    <img
      src={logoUrl}
      alt=""
      className={cn(
        "block h-auto w-auto max-h-full max-w-full shrink-0 object-contain",
        "rounded-2xl border-[6px] border-white bg-white shadow-soft",
        className,
      )}
    />
  );
}
