"use client";

import { Children, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { needsShowMore, shownCount, showMoreLabel } from "@/lib/show-more";
import { cn } from "@/lib/utils";

/**
 * A list that shows its first `initial` rows and a "הצגת עוד" / "הצגת פחות"
 * toggle under them (none when nothing is hidden). The rows are rendered by
 * the server and passed in as `<li>` children; the hidden ones aren't in the
 * DOM until expanded. Focus stays on the toggle both ways, and collapsing
 * keeps the toggle in view instead of leaving the reader far below the list.
 */
export function ShowMoreList({
  children,
  initial,
  className,
  toggleClassName,
}: {
  children: ReactNode;
  initial: number;
  /** the <ul> */
  className?: string;
  /** the row that holds the toggle */
  toggleClassName?: string;
}) {
  const rows = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const hidden = rows.length - shownCount(rows.length, initial, false);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (!next) requestAnimationFrame(() => button.current?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <>
      <ul id={listId} className={className}>
        {rows.slice(0, shownCount(rows.length, initial, expanded))}
      </ul>
      {needsShowMore(rows.length, initial) && (
        <div className={cn("px-5 py-2.5 border-t border-cream-200", toggleClassName)}>
          <button
            ref={button}
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            aria-controls={listId}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-2 text-sm font-medium text-sage-700 hover:text-sage-600 hover:bg-cream-100"
          >
            {showMoreLabel(expanded)}
            {!expanded && <span className="text-ink-muted font-normal">({hidden})</span>}
            <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
