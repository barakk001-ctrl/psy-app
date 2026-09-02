"use client";

import { usePathname } from "next/navigation";
import { ClinicHero } from "@/components/dashboard/clinic-hero";

/**
 * The clinic-room illustration as a slim letterhead on every page. The
 * dashboard skips it — its hero card already carries the full-size version.
 */
export function ClinicBanner() {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cream-200/80 bg-gradient-to-l from-sage-50 via-cream-100 to-cream-50 shadow-soft mb-5 h-20 sm:h-24">
      <ClinicHero className="pointer-events-none select-none absolute inset-y-1 left-3 h-[calc(100%-0.5rem)] w-auto" />
      <div className="relative h-full flex items-center px-5 sm:px-6">
        <span className="font-display text-xl sm:text-2xl text-ink">מרפאה</span>
        <span className="ms-3 text-xs text-ink-subtle hidden sm:inline">
          ניהול קליניקה
        </span>
      </div>
    </div>
  );
}
