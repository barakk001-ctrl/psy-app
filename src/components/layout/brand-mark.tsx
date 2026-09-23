import Link from "next/link";
import { cn } from "@/lib/utils";

export type Branding = { brandName?: string | null; logoUrl?: string | null };

/** The app name in the sidebar and the mobile top bar: the practice's own logo
 *  in place of the "מ" tile when one is set, and its name under the app name. */
export function BrandMark({
  branding,
  size = "md",
}: {
  branding?: Branding;
  size?: "sm" | "md";
}) {
  const tile = size === "md" ? "w-8 h-8 text-sm" : "w-7 h-7 text-xs";
  const name = branding?.brandName?.trim();
  return (
    <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
      {branding?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
        <img
          src={branding.logoUrl}
          alt={name || "לוגו"}
          className={cn(tile, "rounded-xl object-cover shrink-0 shadow-glow bg-white")}
        />
      ) : (
        <div
          className={cn(
            tile,
            "rounded-xl bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center text-cream-50 font-display shadow-glow shrink-0",
          )}
        >
          מ
        </div>
      )}
      <span className="flex flex-col min-w-0 leading-tight">
        <span className={cn("font-display text-ink", size === "md" ? "text-xl" : "text-lg")}>
          מרפאה אישית
        </span>
        {name && <span className="text-xs text-ink-muted truncate">{name}</span>}
      </span>
    </Link>
  );
}
