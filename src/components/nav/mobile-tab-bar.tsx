"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_MOBILE_ITEMS } from "./nav-items";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed inset-x-3 z-30 glass rounded-3xl border border-cream-200/80 shadow-bar"
      style={{ bottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="ניווט ראשי"
    >
      <ul className="flex items-stretch px-1.5 py-1.5">
        {PRIMARY_MOBILE_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl",
                  "transition-all duration-300",
                  active
                    ? "bg-sage-600 text-cream-50 shadow-glow"
                    : "text-ink-muted hover:text-ink active:scale-95",
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
