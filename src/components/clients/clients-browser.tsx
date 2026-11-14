"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ViewTabs, type ViewTab } from "@/components/ui/view-tabs";
import { cn } from "@/lib/utils";
import { ClientListRow, ListTag, type ClientListItem } from "@/components/clients/client-list-row";
import { EntryRow, type WaitlistRow } from "@/components/clients/waitlist-panel";
import { isNumberSearch, matchesSearch, searchWords } from "@/lib/client-search";

type ListKey = "ACTIVE" | "INACTIVE" | "WAITLIST";
const LISTS: ListKey[] = ["ACTIVE", "INACTIVE", "WAITLIST"];
/** What a result from another list is marked with */
const LIST_TAG: Record<ListKey, string> = {
  ACTIVE: "פעיל/ה",
  INACTIVE: "לא פעיל/ה",
  WAITLIST: "רשימת המתנה",
};

/** Below this the box is brought up under the phone's top bar when typing starts (px from the top) */
const PHONE_TOP = 96;

type Found =
  | { list: "ACTIVE" | "INACTIVE"; client: ClientListItem }
  | { list: "WAITLIST"; entry: WaitlistRow };

/**
 * The clients page's tabs with a search box on their row. Typing a name shows
 * everyone it finds — active, inactive and waiting — in place of the open tab,
 * with a label on those from another list; clearing it brings the tab back.
 * The lists are already on the page, so the search runs here in the browser:
 * what is typed is never sent anywhere, kept in the address or written to a log.
 * (The recycle bin isn't searched.)
 */
export function ClientsBrowser({
  tabs,
  active,
  clients,
  waitlist,
}: {
  tabs: ViewTab[];
  active: string;
  clients: ClientListItem[];
  waitlist: WaitlistRow[];
}) {
  const [query, setQuery] = useState("");
  // The open tab: its people come first, without a label
  const [current, setCurrent] = useState(active);
  const input = useRef<HTMLInputElement>(null);

  const words = useMemo(() => searchWords(query), [query]);
  const searching = words.length > 0;

  const found = useMemo<Found[]>(() => {
    if (words.length === 0) return [];
    const byList: Record<ListKey, Found[]> = { ACTIVE: [], INACTIVE: [], WAITLIST: [] };
    for (const client of clients) {
      const name = `${client.firstName} ${client.lastName}`;
      if (matchesSearch(words, { name, phone: client.phone })) {
        byList[client.status].push({ list: client.status, client });
      }
    }
    for (const entry of waitlist) {
      if (matchesSearch(words, { name: entry.fullName, phone: entry.phone })) {
        byList.WAITLIST.push({ list: "WAITLIST", entry });
      }
    }
    const order = [...LISTS.filter((l) => l === current), ...LISTS.filter((l) => l !== current)];
    return order.flatMap((l) => byList[l]);
  }, [words, clients, waitlist, current]);

  // On a phone the keyboard covers the lower half: once the results are up,
  // bring the box to the top so they show above the keyboard
  useEffect(() => {
    if (!searching || !window.matchMedia("(max-width: 639px)").matches) return;
    const box = input.current;
    // (the input carries the scroll margin that clears the top bar)
    if (box && box.getBoundingClientRect().top > PHONE_TOP) {
      box.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [searching]);

  const clear = (refocus: boolean) => {
    setQuery("");
    if (refocus) input.current?.focus();
  };

  const count = !searching
    ? ""
    : found.length === 0
      ? "לא נמצאו תוצאות"
      : found.length === 1
        ? "תוצאה אחת"
        : `${found.length} תוצאות`;

  const box = (
    <div role="search" className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[13rem] sm:max-w-[18rem]">
      <Search
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle"
        aria-hidden
      />
      <input
        ref={input}
        type="text"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="חיפוש לקוח לפי שם או טלפון"
        placeholder="חיפוש לפי שם או טלפון"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            clear(false);
          }
        }}
        className={cn(
          "w-full h-11 sm:h-10 rounded-full border border-cream-300 bg-white/60 ps-10 scroll-mt-[72px]",
          // 16px on phones: anything smaller makes iOS zoom the page on focus
          "text-base sm:text-sm text-ink placeholder:text-ink-subtle",
          "focus:border-sage-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sage-500/15",
          "transition-colors duration-200",
          query ? "pe-10" : "pe-4",
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => clear(true)}
          aria-label="ניקוי החיפוש"
          title="ניקוי החיפוש"
          className="absolute end-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center text-ink-muted hover:bg-cream-200 hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {/* Always here, so a screen reader hears the count change */}
      <p role="status" className="sr-only">
        {count}
      </p>
    </div>
  );

  const results = searching ? (
    found.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="w-10 h-10 mx-auto text-ink-subtle mb-3" strokeWidth={1.25} />
          <h3 className="font-display text-xl text-ink">
            {isNumberSearch(query) ? "לא נמצאו לקוחות עם המספר הזה" : "לא נמצאו לקוחות בשם הזה"}
          </h3>
          <p className="text-ink-muted text-sm mt-1">
            החיפוש עובר על הפעילים, הלא פעילים ורשימת ההמתנה.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => clear(true)}
          >
            ניקוי החיפוש
          </Button>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-2">
        <p className="px-1 text-xs text-ink-muted" aria-hidden>
          {count}
        </p>
        <Card>
          <ul className="divide-y divide-cream-200">
            {found.map((f) => {
              const tag = f.list !== current ? <ListTag>{LIST_TAG[f.list]}</ListTag> : undefined;
              return f.list === "WAITLIST" ? (
                <EntryRow key={`w-${f.entry.id}`} entry={f.entry} tag={tag} />
              ) : (
                <ClientListRow key={`c-${f.client.id}`} client={f.client} tag={tag} />
              );
            })}
          </ul>
        </Card>
      </div>
    )
  ) : null;

  return (
    <ViewTabs
      active={active}
      tabs={tabs}
      aside={box}
      replace={results}
      onSwitch={setCurrent}
      // Choosing a tab is asking for that list: the search steps aside
      onPick={() => setQuery("")}
    />
  );
}
