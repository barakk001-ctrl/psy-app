import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";

export type Branding = { brandName?: string | null; logoUrl?: string | null };

/** The app name in the sidebar and the mobile top bar: the app's mark
 *  (components/brand/logo-mark.tsx) and wordmark, the practice's own logo in
 *  place of the mark when one is set, and its name under the app name. */
export function BrandMark({
  branding,
  size = "md",
}: {
  branding?: Branding;
  size?: "sm" | "md";
}) {
  const px = size === "md" ? 36 : 32;
  const name = branding?.brandName?.trim();
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="מרפאה אישית — לוח הבקרה">
      {branding?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
        <img
          src={branding.logoUrl}
          alt={name || "לוגו"}
          style={{ width: px, height: px }}
          className="rounded-xl object-cover shrink-0 shadow-glow bg-white"
        />
      ) : (
        <LogoMark size={px} />
      )}
      <span className="flex flex-col min-w-0 gap-1">
        <Wordmark className={size === "md" ? "text-xl" : "text-lg"} />
        {name && <span className="text-xs text-ink-muted truncate leading-tight">{name}</span>}
      </span>
    </Link>
  );
}
