"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import { NAV_ITEMS } from "./nav-items";

export function MobileTopBar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer when navigating to a new route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-cream-50/95 backdrop-blur border-b border-cream-300 px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sage-700 flex items-center justify-center text-cream-50 font-display text-xs">
            מ
          </div>
          <span className="font-display text-lg text-ink">מרפאה</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="תפריט"
          className="p-2 -m-2 text-ink-soft hover:text-ink"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel — slides in from the right since the page is RTL */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 end-0 z-50 w-72 max-w-[85vw] bg-cream-50 border-s border-cream-300 shadow-lift",
          "transition-transform duration-200 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="p-4 flex items-center justify-between border-b border-cream-300">
          <span className="font-display text-lg text-ink">תפריט</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגור תפריט"
            className="p-2 -m-2 text-ink-soft hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded text-base transition-colors",
                      active
                        ? "bg-sage-100 text-sage-700 font-medium"
                        : "text-ink-soft hover:bg-cream-200 hover:text-ink",
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-cream-300">
          <div className="text-ink font-medium truncate text-sm">
            {userName ?? "משתמש"}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-ink-muted hover:text-ink mt-1 transition-colors"
            >
              התנתקות
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
