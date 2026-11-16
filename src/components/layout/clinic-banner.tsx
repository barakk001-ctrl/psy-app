"use client";

import { usePathname } from "next/navigation";
import { ClinicHero } from "@/components/dashboard/clinic-hero";
import { HeroLogo } from "@/components/layout/hero-logo";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * A slim letterhead on every page, greeting the user by name (the app name
 * already sits in the top bar / sidebar). Like the dashboard hero it shows
 * the practice's own logo in the large spot once one is uploaded, with the
 * app's mark beside the greeting; until then, the clinic-room illustration.
 * The dashboard has the full hero; the calendar needs every vertical pixel.
 */
export function ClinicBanner({
  userName,
  logoUrl,
}: {
  userName?: string | null;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  if (pathname === "/dashboard" || pathname === "/calendar") return null;

  const firstName = userName?.trim().split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cream-200/80 bg-gradient-to-l from-sage-50 via-cream-100 to-cream-50 shadow-soft mb-5 h-20 sm:h-24">
      {!logoUrl && (
        <ClinicHero className="pointer-events-none select-none absolute inset-y-1 left-3 h-[calc(100%-0.5rem)] w-auto" />
      )}
      <div className="relative h-full flex items-center gap-3 px-5 sm:px-6">
        {logoUrl && <LogoMark size={36} />}
        <span className={`${logoUrl ? "shrink-0 " : ""}font-display text-xl sm:text-2xl text-ink`}>
          {firstName ? `שלום, ${firstName}` : "שלום"}
        </span>
        {/* The logo takes what the greeting leaves, at the far end, so a long
            name and a wide logo never run into each other */}
        {logoUrl && (
          <div className="pointer-events-none flex h-full min-w-0 flex-1 items-center justify-end py-2">
            <HeroLogo logoUrl={logoUrl} className="max-w-[min(100%,22rem)] rounded-xl border-4" />
          </div>
        )}
      </div>
    </div>
  );
}
