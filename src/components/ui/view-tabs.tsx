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

const paramIn = (href: string, param: string) => new URL(href, "http://x").searchParams.get(param);

/**
 * The pill switch between lists on a page (clients, income, expenses) or
 * sections of one (settings). Every panel the server sent stays on the page
 * and the tab only shows one, so a switch keeps the scroll and can't fail.
 * Navigating instead put the page back at the top, and Next was seen to drop
 * those navigations silently. The URL still follows, so a refresh or a shared
 * link opens the same tab, and a link to an anchor inside a panel
 * (/settings#meeting-types) opens that panel and scrolls to it.
 */
export function ViewTabs({
  tabs,
  active,
  children,
  param = "view",
  scroll = false,
  label,
}: {
  tabs: ViewTab[];
  active: string;
  /** Goes under the switch, whatever the tab */
  children?: ReactNode;
  /** The query parameter that holds the tab */
  param?: string;
  /** One row that scrolls sideways when it doesn't fit (phones), instead of wrapping */
  scroll?: boolean;
  /** Names the row for screen readers */
  label?: string;
}) {
  const [current, setCurrent] = useState(active);
  const panels = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLElement>(null);
  // An anchor to scroll to once its panel is showing
  const [anchor, setAnchor] = useState<string | null>(null);

  // A navigation to this page with another tab in its address
  useEffect(() => setCurrent(active), [active]);

  // Coming back can restore a page older than its address: the address wins.
  // An anchor in the address wins over both: it names the card to show.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get(param);
    const tab = tabs.find((t) => t.panel && paramIn(t.href, param) === value);
    if (tab) setCurrent(tab.key);
    const openAnchor = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      const key = el?.closest<HTMLElement>("[data-view-panel]")?.dataset.viewPanel;
      if (!el || !key || !panels.current?.contains(el)) return;
      setCurrent(key);
      setAnchor(id);
    };
    openAnchor();
    window.addEventListener("hashchange", openAnchor);
    return () => window.removeEventListener("hashchange", openAnchor);
    // Only on arrival: after that a tab is what changes the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The panel is visible now, so the browser can find the card
  useEffect(() => {
    if (!anchor) return;
    document.getElementById(anchor)?.scrollIntoView({ block: "start" });
    setAnchor(null);
  }, [anchor]);

  // In a sideways-scrolling row, keep the chosen tab in view
  useEffect(() => {
    if (!scroll || !strip.current) return;
    const on = strip.current.querySelector<HTMLElement>("[aria-current]");
    if (!on) return;
    const row = strip.current;
    const r = row.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    if (b.left < r.left) row.scrollLeft -= r.left - b.left + 12;
    else if (b.right > r.right) row.scrollLeft += b.right - r.right + 12;
  }, [current, scroll]);

  function pick(e: MouseEvent<HTMLAnchorElement>, tab: ViewTab) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // A shorter list mustn't pull the page out from under the reader
    if (panels.current) panels.current.style.minHeight = `${panels.current.offsetHeight}px`;
    setCurrent(tab.key);
    window.history.replaceState(null, "", tab.href);
  }

  const row = (
    <div
      className={cn(
        "inline-flex bg-cream-100 border border-cream-300 rounded-full p-1",
        scroll ? "flex-nowrap" : "flex-wrap",
      )}
    >
      {tabs.map((t) => {
        const className = cn(
          "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
          scroll && "shrink-0 whitespace-nowrap",
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
  );

  return (
    <>
      {scroll ? (
        // Full width so it can scroll at phone width; the row inside keeps its pill look
        <nav
          ref={strip}
          aria-label={label}
          className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {row}
        </nav>
      ) : label ? (
        <nav aria-label={label}>{row}</nav>
      ) : (
        row
      )}
      {children}
      <div ref={panels}>
        {tabs
          .filter((t) => t.panel)
          .map((t) => (
            <div key={t.key} data-view-panel={t.key} hidden={current !== t.key} className="space-y-6">
              {t.panel}
            </div>
          ))}
      </div>
    </>
  );
}
