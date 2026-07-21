"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import { NAV_ITEMS } from "./nav-items";

export function DesktopSidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 border-l border-cream-200/60 glass flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-cream-200/60">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center text-cream-50 font-display text-sm shadow-glow">
            מ
          </div>
          <span className="font-display text-xl text-ink">מרפאה</span>
        </Link>
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
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200",
                    active
                      ? "bg-gradient-to-l from-sage-600 to-sage-500 text-cream-50 font-medium shadow-glow"
                      : "text-ink-soft hover:bg-cream-200/70 hover:text-ink",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-cream-300">
        <div className="px-3 py-2 text-sm">
          <div className="text-ink font-medium truncate">{userName ?? "משתמש"}</div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs text-ink-muted hover:text-ink mt-1 transition-colors"
            >
              התנתקות
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
