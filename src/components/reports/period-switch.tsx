"use client";

import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PeriodKey } from "@/lib/report-periods";

const PeriodContext = createContext<{
  current: PeriodKey;
  pick: (period: PeriodKey, href: string) => void;
}>({ current: "this-month", pick: () => undefined });

const hrefOf = (key: PeriodKey) => (key === "this-month" ? "/reports" : `/reports?period=${key}`);

/**
 * The reports period. The server renders all five periods and only one shows,
 * so a choice is instant, keeps the scroll and has nothing that can fail. The
 * URL still follows, so a refresh opens the same period.
 */
export function PeriodProvider({
  active,
  keys,
  children,
}: {
  active: PeriodKey;
  keys: PeriodKey[];
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(active);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setCurrent(active), [active]);

  // Coming back can restore a page older than its address: the address wins
  useEffect(() => {
    const period = new URLSearchParams(window.location.search).get("period");
    const key = keys.find((k) => k === period);
    setCurrent(key ?? "this-month");
    // Only on arrival: after that a tab is what changes the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(period: PeriodKey, href: string) {
    // A shorter period mustn't pull the page out from under the reader
    if (root.current) root.current.style.minHeight = `${root.current.offsetHeight}px`;
    setCurrent(period);
    window.history.replaceState(null, "", href);
  }

  return (
    <PeriodContext.Provider value={{ current, pick }}>
      <div ref={root} className="space-y-8">
        {children}
      </div>
    </PeriodContext.Provider>
  );
}

/** Part of the page that belongs to one period. */
export function PeriodPanel({ period, children }: { period: PeriodKey; children: ReactNode }) {
  const { current } = useContext(PeriodContext);
  return <div hidden={current !== period}>{children}</div>;
}

/** Five equal columns with a thin line between them, none beside the selected pill. */
export function PeriodTabs({ periods }: { periods: { key: PeriodKey; label: string }[] }) {
  const { current, pick } = useContext(PeriodContext);

  const onClick = (e: MouseEvent<HTMLAnchorElement>, key: PeriodKey) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    pick(key, hrefOf(key));
  };

  return (
    <div
      className="grid grid-cols-5 w-full sm:max-w-xl bg-cream-100 border border-cream-300 rounded-full p-1"
      role="tablist"
    >
      {periods.map((p, i) => {
        const line = i > 0 && current !== p.key && current !== periods[i - 1].key;
        return (
          <div
            key={p.key}
            role="presentation"
            className={cn("flex border-s", line ? "border-cream-300" : "border-transparent")}
          >
            <a
              href={hrefOf(p.key)}
              role="tab"
              aria-selected={current === p.key}
              onClick={(e) => onClick(e, p.key)}
              className={cn(
                "flex-1 flex items-center justify-center text-center leading-tight",
                "px-1 py-1.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors",
                current === p.key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {p.label}
            </a>
          </div>
        );
      })}
    </div>
  );
}
