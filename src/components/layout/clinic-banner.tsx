"use client";

import { usePathname } from "next/navigation";
import { ClinicHero } from "@/components/dashboard/clinic-hero";

/**
 * The clinic-room illustration as a slim letterhead on every page, greeting
 * the user by name (the app name already sits in the top bar / sidebar).
 * The dashboard has the full hero; the calendar needs every vertical pixel.
 */
export function ClinicBanner({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  if (pathname === "/dashboard" || pathname === "/calendar") return null;

  const firstName = userName?.trim().split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cream-200/80 bg-gradient-to-l from-sage-50 via-cream-100 to-cream-50 shadow-soft mb-5 h-20 sm:h-24">
      <ClinicHero className="pointer-events-none select-none absolute inset-y-1 left-3 h-[calc(100%-0.5rem)] w-auto" />
      <div className="relative h-full flex items-center px-5 sm:px-6">
        <span className="font-display text-xl sm:text-2xl text-ink">
          {firstName ? `שלום, ${firstName}` : "שלום"}
        </span>
      </div>
    </div>
  );
}
