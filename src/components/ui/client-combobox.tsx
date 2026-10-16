"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { matchClients, type ClientChoice } from "@/lib/follow-up-filters";
import { cn } from "@/lib/utils";

/**
 * Searchable client picker (type-ahead on the name). Empty = "כל המטופלים".
 * The list is the user's own clients (a solo practice: at most a few
 * hundred names), so matching happens in the browser; what the choice
 * filters is queried server-side by the page.
 */
export function ClientCombobox({
  id,
  clients,
  value,
  onChange,
  className,
}: {
  id?: string;
  clients: ClientChoice[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const selected = value ? clients.find((c) => c.id === value) ?? null : null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = open ? matchClients(clients, query) : [];

  // Close when tapping anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (c: ClientChoice | null) => {
    onChange(c?.id ?? null);
    setQuery("");
    setOpen(false);
    if (c === null) inputRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="סינון לפי מטופל/ת"
          autoComplete="off"
          placeholder={selected ? selected.name : "כל המטופלים — הקלידו שם לסינון"}
          value={selected && !open ? selected.name : query}
          onFocus={() => {
            setOpen(true);
            setHighlight(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (open && matches[highlight]) {
                e.preventDefault();
                choose(matches[highlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            } else if (e.key === "Backspace" && selected && query === "") {
              choose(null);
            }
          }}
          className={cn(
            "w-full h-11 rounded-xl border bg-white/60 text-ink placeholder:text-ink-subtle",
            "border-cream-300 focus:border-sage-500 focus:bg-white",
            "focus:outline-none focus:ring-4 focus:ring-sage-500/15 transition-colors duration-200",
            "ps-9 pe-10",
            selected && "font-medium",
          )}
        />
        {selected && (
          <button
            type="button"
            onClick={() => choose(null)}
            aria-label="הצגת כל המטופלים"
            title="הצגת כל המטופלים"
            className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center text-ink-muted hover:bg-cream-200 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border border-cream-300 bg-white shadow-lift py-1"
        >
          {!query && (
            <li role="option" aria-selected={!selected}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(null)}
                className={cn(
                  "w-full text-start px-3.5 py-2.5 text-sm hover:bg-cream-100",
                  !selected ? "text-sage-700 font-medium" : "text-ink",
                )}
              >
                כל המטופלים
              </button>
            </li>
          )}
          {matches.map((c, i) => (
            <li key={c.id} role="option" aria-selected={c.id === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(c)}
                className={cn(
                  "w-full text-start px-3.5 py-2.5 text-sm flex items-center justify-between gap-3",
                  i === highlight ? "bg-cream-100" : "hover:bg-cream-100",
                  c.id === value ? "text-sage-700 font-medium" : "text-ink",
                )}
              >
                <span className="truncate">{c.name}</span>
                {!c.active && <span className="text-[11px] text-ink-subtle shrink-0">לא פעיל/ה</span>}
              </button>
            </li>
          ))}
          {query && matches.length === 0 && (
            <li className="px-3.5 py-2.5 text-sm text-ink-muted">לא נמצא/ה מטופל/ת בשם הזה.</li>
          )}
        </ul>
      )}
    </div>
  );
}
