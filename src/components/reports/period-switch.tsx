"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CUSTOM_PERIOD,
  CUSTOM_PERIOD_LABEL,
  DEFAULT_PERIOD,
  customPeriodHref,
  parseDateRange,
  periodHref,
  type PeriodChoice,
  type PeriodKey,
} from "@/lib/report-periods";

const PeriodContext = createContext<{
  current: PeriodChoice;
  pick: (period: PeriodChoice, href: string) => void;
}>({ current: DEFAULT_PERIOD, pick: () => undefined });

/**
 * The reports period. The server renders every fixed period and only one
 * shows, so a choice is instant, keeps the scroll and has nothing that can
 * fail. The URL still follows, so a refresh opens the same period. Only a
 * range of her own dates is a navigation: the server loads it.
 */
export function PeriodProvider({
  active,
  keys,
  stamp,
  children,
}: {
  active: PeriodChoice;
  /** The periods this render has panels for */
  keys: PeriodChoice[];
  /** Changes whenever the server answers with another choice or range */
  stamp: string;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(active);
  const root = useRef<HTMLDivElement>(null);

  // A new answer from the server (another custom range included) is shown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setCurrent(active), [stamp]);

  // Coming back can restore a page older than its address: the address wins
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const asked = query.get("from") && query.get("to") ? CUSTOM_PERIOD : query.get("period");
    setCurrent(keys.find((k) => k === asked) ?? DEFAULT_PERIOD);
    // Only on arrival: after that the picker is what changes the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(period: PeriodChoice, href: string) {
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
export function PeriodPanel({ period, children }: { period: PeriodChoice; children: ReactNode }) {
  const { current } = useContext(PeriodContext);
  return <div hidden={current !== period}>{children}</div>;
}

/**
 * The period dropdown: the fixed periods, each with what it covers today in
 * brackets, then "לבחירת טווח תאריכים", which opens two dates and a button.
 * A native select, so a phone shows its own wheel.
 */
export function PeriodPicker({
  periods,
  custom,
}: {
  periods: { key: PeriodKey; label: string; from: string; to: string }[];
  /** The range the server rendered, if the address asks for one */
  custom: { from: string; to: string } | null;
}) {
  const { current, pick } = useContext(PeriodContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // She chose "טווח תאריכים" and hasn't asked to show it yet
  const [choosing, setChoosing] = useState(false);
  const [from, setFrom] = useState(custom?.from ?? "");
  const [to, setTo] = useState(custom?.to ?? "");

  // Back/forward between two ranges: the fields follow the one shown
  useEffect(() => {
    if (!custom) return;
    setFrom(custom.from);
    setTo(custom.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom?.from, custom?.to]);

  const showDates = choosing || current === CUSTOM_PERIOD;
  const ready = !!from && !!to;
  const backwards = ready && from > to;
  const parsed = ready && !backwards ? parseDateRange(from, to) : null;
  const shown = current === CUSTOM_PERIOD && custom?.from === from && custom?.to === to;

  function onSelect(value: string) {
    if (value === CUSTOM_PERIOD) {
      // Start from the dates on screen, so the fields are never empty
      const onScreen = periods.find((p) => p.key === current);
      if (!ready && onScreen) {
        setFrom(onScreen.from);
        setTo(onScreen.to);
      }
      setChoosing(true);
      // The range the server already loaded comes straight back
      if (custom && from === custom.from && to === custom.to) {
        pick(CUSTOM_PERIOD, customPeriodHref(custom.from, custom.to));
      }
      return;
    }
    const period = periods.find((p) => p.key === value);
    if (!period) return;
    setChoosing(false);
    pick(period.key, periodHref(period.key));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    const href = customPeriodHref(parsed.from, parsed.to);
    // Already loaded: show it; otherwise the server loads the range
    if (custom?.from === parsed.from && custom?.to === parsed.to) pick(CUSTOM_PERIOD, href);
    else startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <div className="w-full sm:w-80">
      <label htmlFor="report-period" className="sr-only">
        תקופה
      </label>
      <div className="relative">
        <CalendarDays
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-600"
        />
        <Select
          id="report-period"
          value={showDates ? CUSTOM_PERIOD : current}
          onChange={(e) => onSelect(e.target.value)}
          className="ps-10 bg-white font-medium"
        >
          {periods.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM_PERIOD}>{CUSTOM_PERIOD_LABEL}</option>
        </Select>
      </div>

      {showDates && (
        <form onSubmit={onSubmit} className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="report-from">מתאריך</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="report-to">עד תאריך</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button type="submit" className="col-span-2" disabled={!parsed || pending || shown}>
            {pending ? "טוען…" : shown ? "הטווח מוצג" : "הצגת הטווח"}
          </Button>
          {backwards && (
            <p className="col-span-2 text-xs text-terracotta-600">תאריך הסיום לפני תאריך ההתחלה.</p>
          )}
          {ready && !backwards && !parsed && (
            <p className="col-span-2 text-xs text-terracotta-600">אפשר לבחור טווח של עד 5 שנים.</p>
          )}
          {!shown && !pending && parsed && (
            <p className="col-span-2 text-xs text-ink-muted">
              הנתונים למטה יתעדכנו אחרי לחיצה על ״הצגת הטווח״.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
