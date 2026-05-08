"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_MOBILE_ITEMS } from "./nav-items";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-cream-50/95 backdrop-blur border-t border-cream-300 pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="ניווט ראשי"
    >
      <ul className="flex items-stretch">
        {PRIMARY_MOBILE_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 transition-colors",
                  active ? "text-sage-700" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
                <span
                  className={cn(
                    "text-[10px]",
                    active ? "font-medium" : "font-normal",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
