"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ViewTab = {
  key: string;
  label: string;
  href: string;
  /** Already loaded: the tab switches in place. Without one, it's a link. */
  panel?: ReactNode;
};

const viewIn = (href: string) => new URL(href, "http://x").searchParams.get("view");

/**
 * The pill switch between lists on a page (clients, income, expenses). Every
 * list the server sent stays on the page and the tab only shows one, so a
 * switch keeps the scroll and can't fail. Navigating instead put the page back
 * at the top, and Next was seen to drop those navigations silently. The URL
 * still follows, so a refresh or a shared link opens the same tab.
 */
export function ViewTabs({
  tabs,
  active,
  children,
}: {
  tabs: ViewTab[];
  active: string;
  /** Goes under the switch, whatever the tab */
  children?: ReactNode;
}) {
  const [current, setCurrent] = useState(active);
  const panels = useRef<HTMLDivElement>(null);

  // A navigation to this page with another tab in its address
  useEffect(() => setCurrent(active), [active]);

  // Coming back can restore a page older than its address: the address wins
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    const tab = tabs.find((t) => t.panel && viewIn(t.href) === view);
    if (tab) setCurrent(tab.key);
    // Only on arrival: after that a tab is what changes the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(e: MouseEvent<HTMLAnchorElement>, tab: ViewTab) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // A shorter list mustn't pull the page out from under the reader
    if (panels.current) panels.current.style.minHeight = `${panels.current.offsetHeight}px`;
    setCurrent(tab.key);
    window.history.replaceState(null, "", tab.href);
  }

  return (
    <>
      <div className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1 flex-wrap">
        {tabs.map((t) => {
          const className = cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            current === t.key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
          );
          const on = current === t.key ? ("page" as const) : undefined;
          return t.panel ? (
            <a key={t.key} href={t.href} aria-current={on} onClick={(e) => pick(e, t)} className={className}>
              {t.label}
            </a>
          ) : (
            <Link key={t.key} href={t.href} aria-current={on} className={className}>
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
      <div ref={panels}>
        {tabs
          .filter((t) => t.panel)
          .map((t) => (
            <div key={t.key} hidden={current !== t.key} className="space-y-6">
              {t.panel}
            </div>
          ))}
      </div>
    </>
  );
}
