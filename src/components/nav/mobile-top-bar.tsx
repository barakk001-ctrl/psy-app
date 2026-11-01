"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import { NAV_ITEMS } from "./nav-items";
import { BrandMark, type Branding } from "@/components/layout/brand-mark";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

export function MobileTopBar({
  userName,
  branding,
}: {
  userName?: string | null;
  branding?: Branding;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, drawerRef, () => setOpen(false));

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
      <header className="lg:hidden sticky top-0 z-30 glass border-b border-cream-200/60 px-4 h-14 flex items-center justify-between">
        <BrandMark branding={branding} size="sm" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="תפריט"
          aria-expanded={open}
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

      {/* Drawer panel — slides in from the right side of the screen.
          We use inline styles + explicit `right: 0` (not `end-0`) to bypass any
          RTL-aware Tailwind direction flipping which has caused the drawer to
          stay visible when closed. */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט"
        className={cn(
          "lg:hidden fixed inset-y-0 z-50 w-72 max-w-[85vw] glass border-l border-cream-200/60 shadow-lift",
          "rounded-s-3xl flex flex-col outline-none",
        )}
        style={{
          right: 0,
          transform: open ? "translateX(0)" : "translateX(100%)",
          // Closed: out of the tab order and away from screen readers, once
          // the slide-out has finished. Opening is immediate, or the focus
          // moved in by useDialogFocus would land on a hidden panel.
          visibility: open ? "visible" : "hidden",
          transition: open
            ? "transform 300ms ease-out"
            : "transform 300ms ease-out, visibility 0s linear 300ms",
        }}
      >
        <div className="p-4 flex items-center justify-between border-b border-cream-300">
          <span className="font-display text-lg text-ink">תפריט</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגירת התפריט"
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
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl text-base transition-all duration-200",
                      active
                        ? "bg-gradient-to-l from-sage-600 to-sage-500 text-cream-50 font-medium shadow-glow"
                        : "text-ink-soft hover:bg-cream-200/70 hover:text-ink",
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
