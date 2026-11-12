"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import heLocale from "@fullcalendar/core/locales/he";
import type { EventInput } from "@fullcalendar/core";
import { rescheduleSessionAction } from "@/server/actions/sessions";
import { setShowHolidaysAction } from "@/server/actions/settings";
import type { HolidayMap } from "@/lib/holidays";
import {
  HEBREW_DATE_ON,
  hebrewCellLabel,
  hebrewDateOn,
  hebrewDateStorageKey,
  hebrewRangeLabel,
  type CivilDay,
} from "@/lib/hebrew-date";
import type { WindowUi } from "@/lib/scheduling-window";
import { hourRange, minutesOfDay, slotTime } from "@/lib/calendar-hours";
import { darkenForText } from "@/lib/color-contrast";
import {
  QuickEditDialog,
  type QuickEditData,
} from "@/components/calendar/quick-edit-dialog";

type Props = {
  events: EventInput[];
  clients: { id: string; name: string }[];
  meetingTypes: string[];
  // Meeting-type label → color chosen in settings; scheduled events use it
  typeColors?: Record<string, string>;
  /** yyyy-MM-dd → Israeli holidays that day (Hebcal) */
  holidays?: HolidayMap;
  showHolidays?: boolean;
  /** The account, for the "תאריך עברי" choice this browser remembers */
  userId?: string;
  defaultMinutes?: number;
  /** Free trial: how far ahead meetings may be booked (null = no limit). */
  scheduleWindow?: WindowUi | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// The day as the calendar writes it (FullCalendar's dates are local), which is
// what a Hebrew date is computed from: no instant, so no timezone and no sunset
const civilDay = (d: Date): CivilDay => ({
  year: d.getFullYear(),
  month: d.getMonth() + 1,
  day: d.getDate(),
});

// Color sessions by status — sage for scheduled, muted for past, terracotta for problems.
const STATUS_BG: Record<string, string> = {
  SCHEDULED: "#5C7559",
  COMPLETED: "#74685A",
  CANCELLED: "#D4CCB9",
  NO_SHOW: "#A3573E",
};

const EVENT_TEXT = "#FDFBF7";

/**
 * FullCalendar's own markup: the prev/next icons are role="img" with no name
 * (the button around them has one).
 */
function fixCalendarIcons(root: Element | null) {
  root?.querySelectorAll(".fc-icon[role='img']").forEach((el) => {
    el.removeAttribute("role");
    el.setAttribute("aria-hidden", "true");
  });
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function CalendarView({
  events,
  clients,
  meetingTypes,
  typeColors,
  holidays = {},
  showHolidays: showHolidaysInitial = false,
  userId = "",
  defaultMinutes,
  scheduleWindow,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isMobile = useIsMobile();
  const [quickEdit, setQuickEdit] = useState<QuickEditData | null>(null);
  // The days on screen (FullCalendar's datesSet) — the week and day views show
  // only the hours that hold meetings in them, so the grid fits without scrolling
  const [visible, setVisible] = useState<{ start: number; end: number } | null>(null);
  // Optimistic: the box flips at once and the choice is saved to the account
  const [showHolidays, setShowHolidays] = useState(showHolidaysInitial);
  const holidayOn = (d: Date) => (showHolidays ? holidays[dayKey(d)] : undefined);
  const toggleHolidays = () => {
    const on = !showHolidays;
    setShowHolidays(on);
    startTransition(async () => {
      try {
        await setShowHolidaysAction(on);
      } catch {
        setShowHolidays(!on);
      }
    });
  };

  // "תאריך עברי": remembered in this browser (localStorage, a key per
  // account) — there is no column for it. Read after mount, so it starts off.
  const [showHebrew, setShowHebrew] = useState(false);
  useEffect(() => {
    try {
      setShowHebrew(hebrewDateOn(window.localStorage.getItem(hebrewDateStorageKey(userId))));
    } catch {
      // storage blocked (private mode): the box simply isn't remembered
    }
  }, [userId]);
  const toggleHebrew = () => {
    const on = !showHebrew;
    setShowHebrew(on);
    try {
      if (on) window.localStorage.setItem(hebrewDateStorageKey(userId), HEBREW_DATE_ON);
      else window.localStorage.removeItem(hebrewDateStorageKey(userId));
    } catch {
      // still shown until the page is left
    }
  };
  // The period the title names (the month, not the grid's leading and trailing
  // days), for the Hebrew months beside it
  const [titleRange, setTitleRange] = useState<{ start: number; end: number } | null>(null);
  const hebrewTitle = useMemo(() => {
    if (!showHebrew || !titleRange) return null;
    const last = new Date(titleRange.end);
    last.setDate(last.getDate() - 1);
    return hebrewRangeLabel(civilDay(new Date(titleRange.start)), civilDay(last));
  }, [showHebrew, titleRange]);

  const hours = useMemo(() => {
    if (!visible) return hourRange([]);
    const inView = events.flatMap((e) => {
      const start = new Date(e.start as string);
      const end = new Date((e.end ?? e.start) as string);
      if (end.getTime() <= visible.start || start.getTime() >= visible.end) return [];
      return [{ start: minutesOfDay(start), end: minutesOfDay(end) }];
    });
    return hourRange(inView);
  }, [events, visible]);
  // Long days (a meeting at dawn and one late at night) get hour rows, so the
  // labels still fit; otherwise half-hour rows
  const longDay = hours.last - hours.first > 15;

  const styledEvents: EventInput[] = events.map((e) => {
    const status = (e.extendedProps?.status as string) ?? "SCHEDULED";
    // Scheduled events take the meeting type's color; other statuses keep
    // their signal colors (completed/cancelled/no-show).
    const typeColor =
      status === "SCHEDULED"
        ? typeColors?.[e.extendedProps?.treatmentType as string]
        : undefined;
    // Cancelled is a pale tile with dark text; everything else carries light
    // text, on a colour darkened just enough to stay readable at this size.
    const cancelled = status === "CANCELLED";
    const base = typeColor ?? STATUS_BG[status] ?? STATUS_BG.SCHEDULED!;
    const bg = cancelled ? base : darkenForText(base, EVENT_TEXT);
    return {
      ...e,
      backgroundColor: bg,
      borderColor: bg,
      textColor: cancelled ? "#1A1714" : EVENT_TEXT,
    };
  });

  return (
    <div
      className={
        "rounded-2xl bg-white/85 backdrop-blur-sm border border-cream-200/80 shadow-soft p-2 sm:p-4 calendar-shell" +
        (hebrewTitle ? " hebrew-on" : "")
      }
      // Shown under FullCalendar's own title by CSS (it has no hook for the title)
      style={hebrewTitle ? ({ "--hebrew-title": JSON.stringify(hebrewTitle) } as CSSProperties) : undefined}
    >
      <div className="calendar-grid">
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        // Force re-render when viewport changes so toolbar layout takes effect
        key={isMobile ? "mobile" : "desktop"}
        locale={heLocale}
        direction="rtl"
        firstDay={0}
        // Meetings can be reached with Tab; Enter opens one like a click
        eventInteractive
        viewDidMount={(arg) => fixCalendarIcons(arg.el.closest(".calendar-shell"))}
        // FullCalendar labels a day by its number alone, which hides the
        // meetings inside it from screen readers
        dayCellDidMount={(arg) => arg.el.removeAttribute("aria-labelledby")}
        // Fill the fixed-height shell; the grid scrolls internally, not the page
        height="100%"
        headerToolbar={
          isMobile
            ? {
                start: "prev,next",
                center: "title",
                end: "today",
              }
            : {
                start: "prev,next today",
                center: "title",
                end: "holidays hebrewDate dayGridMonth,timeGridWeek,timeGridDay",
              }
        }
        // The two switches live in a toolbar rather than on a row of their
        // own: every pixel of height is a meeting more per day in month view.
        customButtons={{
          holidays: {
            text: (showHolidays ? "☑" : "☐") + " מועדי ישראל",
            hint: "הצגת מועדי ישראל ביומן",
            click: toggleHolidays,
          },
          hebrewDate: {
            text: (showHebrew ? "☑" : "☐") + " תאריך עברי",
            hint: "הצגת התאריך העברי ביומן",
            click: toggleHebrew,
          },
        }}
        // On a phone the view buttons sit below the grid, and the two switches
        // beside them: in the header they pushed it onto a second row
        footerToolbar={
          isMobile
            ? {
                start: "dayGridMonth,timeGridWeek,timeGridDay",
                end: "holidays hebrewDate",
              }
            : undefined
        }
        buttonText={{
          today: "היום",
          month: "חודש",
          week: "שבוע",
          day: "יום",
        }}
        // Week/day: only the hours in use, every row stretched to fill the
        // shell (expandRows) and no all-day row (meetings always have times)
        // — the whole grid fits on screen like the month view
        slotMinTime={slotTime(hours.first)}
        slotMaxTime={slotTime(hours.last)}
        slotDuration={longDay ? "01:00:00" : "00:30:00"}
        slotLabelInterval="01:00"
        expandRows
        allDaySlot={false}
        datesSet={(arg) => {
          const next = { start: arg.start.getTime(), end: arg.end.getTime() };
          setVisible((prev) =>
            prev && prev.start === next.start && prev.end === next.end ? prev : next,
          );
          const named = {
            start: arg.view.currentStart.getTime(),
            end: arg.view.currentEnd.getTime(),
          };
          setTitleRange((prev) =>
            prev && prev.start === named.start && prev.end === named.end ? prev : named,
          );
        }}
        views={{
          // Start time only in the week view — the columns are narrow
          timeGridWeek: { displayEventEnd: false },
        }}
        // Month view: solid pills showing "HH:MM name" instead of dot+time
        eventDisplay="block"
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventContent={(arg) => {
          if (arg.view.type === "dayGridMonth") {
            return (
              <div className="fc-month-pill">
                <span className="fc-month-pill-time">{arg.timeText}</span>{" "}
                <span className="fc-month-pill-name">{arg.event.title}</span>
              </div>
            );
          }
          // Week/day: time and client name, compact enough for short rows
          return (
            <div className="fc-tg-event">
              <span className="fc-tg-time">{arg.timeText}</span>{" "}
              <span className="fc-tg-name">{arg.event.title}</span>
            </div>
          );
        }}
        // Show only the weeks the month has (5 more often than 6) and let each
        // day hold what fits, with "+N נוספים" for the rest. A fixed 3 per day
        // made rows taller than the screen and the month scrolled inside itself.
        fixedWeekCount={false}
        dayMaxEvents
        // Holidays: a small line beside the day number (month) or under the
        // weekday (week/day), like any calendar app. Not events, so they can't
        // be dragged, clicked into the edit dialog, or counted as meetings.
        // The Hebrew date sits with the day number (month) or under the
        // weekday (week/day): the day alone, and with its month on the first of
        // a Hebrew month and on the first day on screen — always in day view.
        dayCellContent={(arg) => {
          if (arg.view.type !== "dayGridMonth") return undefined;
          const hs = holidayOn(arg.date);
          const hebrew = showHebrew
            ? hebrewCellLabel(civilDay(arg.date), civilDay(arg.view.activeStart))
            : null;
          return (
            <span className="fc-day-top-inner">
              {hs && (
                <span className="fc-holiday" title={hs.join(" · ")}>
                  {hs.join(" · ")}
                </span>
              )}
              <span className="fc-day-num">
                <span>{arg.dayNumberText}</span>
                {hebrew && <span className="fc-hebdate">{hebrew}</span>}
              </span>
            </span>
          );
        }}
        dayHeaderContent={(arg) => {
          // The month view's header is a weekday, not a date
          const dated = arg.view.type !== "dayGridMonth";
          const hs = dated ? holidayOn(arg.date) : undefined;
          const hebrew =
            dated && showHebrew
              ? hebrewCellLabel(
                  civilDay(arg.date),
                  civilDay(arg.view.activeStart),
                  arg.view.type === "timeGridDay",
                )
              : null;
          return (
            <span className="fc-head-inner">
              <span>{arg.text}</span>
              {hebrew && <span className="fc-hebdate">{hebrew}</span>}
              {hs && <span className="fc-holiday">{hs.join(" · ")}</span>}
            </span>
          );
        }}
        nowIndicator
        editable
        selectable
        selectMirror
        // Touch interactions: hold ~250ms to start a select / drag
        longPressDelay={250}
        selectLongPressDelay={250}
        eventLongPressDelay={250}
        events={styledEvents}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const p = info.event.extendedProps as {
            clientId?: string;
            treatmentType?: string;
            status?: string;
            startLocal?: string;
            endLocal?: string;
          };
          // Legacy events without the quick-edit payload fall back to the page
          if (!p.startLocal || !p.endLocal || !p.clientId) {
            router.push(`/sessions/${info.event.id}`);
            return;
          }
          setQuickEdit({
            id: info.event.id,
            clientId: p.clientId,
            clientName: info.event.title,
            date: p.startLocal.slice(0, 10),
            startTime: p.startLocal.slice(11, 16),
            endTime: p.endLocal.slice(11, 16),
            treatmentType: p.treatmentType ?? "",
            cancelled: p.status === "CANCELLED",
          });
        }}
        select={(info) => {
          // Format the local time for the datetime-local input
          const pad = (n: number) => String(n).padStart(2, "0");
          const d = info.start;
          const startsAt =
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
            `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          router.push(`/sessions/new?start=${encodeURIComponent(startsAt)}`);
        }}
        eventDrop={(info) => {
          startTransition(async () => {
            try {
              const res = await rescheduleSessionAction({
                id: info.event.id,
                startsAt: info.event.start!.toISOString(),
                endsAt: info.event.end!.toISOString(),
              });
              if (!res.ok) {
                if (res.error) window.alert(res.error);
                info.revert();
                return;
              }
              router.refresh();
            } catch {
              info.revert();
            }
          });
        }}
        eventResize={(info) => {
          startTransition(async () => {
            try {
              const res = await rescheduleSessionAction({
                id: info.event.id,
                startsAt: info.event.start!.toISOString(),
                endsAt: info.event.end!.toISOString(),
              });
              if (!res.ok) {
                if (res.error) window.alert(res.error);
                info.revert();
                return;
              }
              router.refresh();
            } catch {
              info.revert();
            }
          });
        }}
      />

      {quickEdit && (
        <QuickEditDialog
          data={quickEdit}
          clients={clients}
          meetingTypes={meetingTypes}
          defaultMinutes={defaultMinutes}
          scheduleWindow={scheduleWindow}
          onClose={() => setQuickEdit(null)}
        />
      )}
      </div>

      <style jsx global>{`
        /* Fixed-height shell: the calendar grid scrolls inside it, the page
           doesn't — sized so the full month view fits the viewport (no page
           banner on /calendar, compact header). */
        .calendar-shell {
          /* page padding + the compact header above, and nothing more */
          height: calc(100dvh - 9.5rem);
          min-height: 460px;
          display: flex;
          flex-direction: column;
        }
        .calendar-shell .calendar-grid {
          flex: 1;
          min-height: 0;
        }
        .calendar-shell .fc-daygrid-day-number {
          width: 100%;
          padding: 1px 4px;
        }
        /* Compact month rows so more meetings fit a day before "+N נוספים" */
        .calendar-shell .fc-daygrid-day-events {
          margin-bottom: 0;
        }
        .calendar-shell .fc-daygrid-event-harness + .fc-daygrid-event-harness {
          margin-top: 1px;
        }
        .calendar-shell .fc-daygrid-block-event {
          padding-block: 0;
        }
        .calendar-shell .fc-daygrid-more-link {
          font-size: 0.66rem;
          line-height: 1.2;
          color: #6b5f52;
        }
        .calendar-shell .fc-day-top-inner {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.35rem;
          width: 100%;
        }
        .calendar-shell .fc-head-inner {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.25;
        }
        .calendar-shell .fc-holiday {
          color: #b5654a;
          font-size: 0.66rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        /* The Hebrew date: small and muted, beside the day number */
        .calendar-shell .fc-day-num {
          display: inline-flex;
          align-items: baseline;
          gap: 0.35rem;
          min-width: 0;
        }
        .calendar-shell .fc-hebdate {
          color: #74685a;
          font-size: 0.68rem;
          font-weight: 400;
          white-space: nowrap;
        }
        /* A holiday that no longer fits beside the two dates takes its own
           line under them, rather than pushing the Hebrew date out of the cell
           (phones already stack them, below) */
        @media (min-width: 768px) {
          .calendar-shell.hebrew-on .fc-day-top-inner {
            flex-wrap: wrap-reverse;
            gap: 0 0.35rem;
          }
          .calendar-shell.hebrew-on .fc-day-top-inner .fc-day-num {
            flex-shrink: 0;
          }
        }
        /* …and the Hebrew months under the title. The two lines together are
           as tall as the toolbar's buttons, so the grid loses nothing. (Beside
           the title it pushed the toolbar onto two rows below ~1200px.) */
        .calendar-shell.hebrew-on .fc .fc-toolbar-title {
          line-height: 1.1;
          text-align: center;
        }
        .calendar-shell.hebrew-on .fc .fc-toolbar-title::after {
          content: var(--hebrew-title);
          display: block;
          font-family: var(--font-sans);
          font-size: 0.7rem;
          font-weight: 400;
          line-height: 1.05;
          color: #74685a;
          white-space: nowrap;
        }
        @media (max-width: 767px) {
          .calendar-shell {
            height: calc(100dvh - 16.5rem);
            min-height: 420px;
          }
        }

        /* Calendar styling to match the design system */
        .calendar-shell .fc {
          font-family: var(--font-sans);
          --fc-border-color: #e8e2d5;
          --fc-page-bg-color: #ffffff;
          --fc-neutral-bg-color: #faf7f1;
          --fc-today-bg-color: #f1f4ed;
          --fc-button-bg-color: #faf7f1;
          --fc-button-border-color: #e8e2d5;
          --fc-button-text-color: #3a332c;
          --fc-button-hover-bg-color: #f2ede2;
          --fc-button-hover-border-color: #d4ccb9;
          --fc-button-active-bg-color: #5c7559;
          --fc-button-active-border-color: #4a6048;
          --fc-now-indicator-color: #b5654a;
        }
        .calendar-shell .fc .fc-toolbar-title {
          font-family: var(--font-display);
          font-size: 1.25rem;
          color: #1a1714;
        }
        .calendar-shell .fc .fc-button {
          text-transform: none;
          font-weight: 500;
          font-size: 0.8rem;
          padding: 0.35rem 0.7rem;
        }
        /* A tablet, and a small laptop beside the sidebar, leave the toolbar
           ~670px: tighter buttons and a smaller title, so a week that spans
           two months ("30 באוג׳ – 5 בספט׳ 2026") still shares one row with
           both switches */
        @media (min-width: 768px) and (max-width: 1099px) {
          .calendar-shell .fc .fc-toolbar-title {
            font-size: 1.1rem;
          }
          .calendar-shell .fc .fc-button {
            padding-inline: 0.45rem;
          }
        }
        .calendar-shell .fc .fc-button-primary:not(:disabled).fc-button-active,
        .calendar-shell .fc .fc-button-primary:not(:disabled):active {
          color: #fdfbf7;
        }
        .calendar-shell .fc .fc-col-header-cell-cushion,
        .calendar-shell .fc .fc-daygrid-day-number {
          color: #6b5f52;
          font-weight: 500;
          font-size: 0.78rem;
        }
        .calendar-shell .fc .fc-timegrid-slot-label-cushion {
          color: #74685a;
          font-size: 0.72rem;
        }
        .calendar-shell .fc-event {
          border-radius: 4px;
          font-size: 0.78rem;
          padding: 1px 4px;
          cursor: pointer;
        }
        /* Month-view pills: time + client name on one line, ellipsized */
        .calendar-shell .fc-month-pill {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.68rem;
          line-height: 1.3;
          direction: rtl;
        }
        .calendar-shell .fc-month-pill-time {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .calendar-shell .fc-daygrid-event {
          margin-inline: 1px;
        }
        .calendar-shell .fc-timegrid-event-harness > .fc-timegrid-event {
          box-shadow: none;
        }
        /* Week/day views fit the shell: rows may shrink to a few pixels and
           expandRows stretches them to fill it, so the grid never scrolls */
        .calendar-shell .fc .fc-timegrid-slot {
          height: 6px;
          /* an empty cell still keeps a line's height unless the font is 0;
             the hour labels set their own size below */
          font-size: 0;
          line-height: 0;
        }
        /* The hour label hangs from the top of its row instead of setting
           the row's height, so even a small phone fits the whole day */
        .calendar-shell .fc .fc-timegrid-slot-label-frame {
          height: 0;
          overflow: visible;
        }
        .calendar-shell .fc .fc-timegrid-slot-label-cushion {
          line-height: 1;
          padding-top: 2px;
        }
        .calendar-shell .fc .fc-timegrid-slot-label-cushion {
          padding-block: 0;
        }
        .calendar-shell .fc-timegrid-event {
          padding: 0 3px;
        }
        .calendar-shell .fc-tg-event {
          overflow: hidden;
          height: 100%;
          font-size: 0.72rem;
          line-height: 1.2;
          direction: rtl;
        }
        .calendar-shell .fc-tg-time {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .calendar-shell .fc-tg-name {
          font-weight: 500;
        }

        /* Mobile-only adjustments */
        @media (max-width: 767px) {
          .calendar-shell .fc .fc-toolbar {
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .calendar-shell .fc .fc-toolbar-title {
            font-size: 1rem;
          }
          .calendar-shell .fc .fc-button {
            font-size: 0.72rem;
            padding: 0.3rem 0.55rem;
          }
          /* Footer toolbar (view switcher and the two switches) on mobile */
          .calendar-shell .fc .fc-footer-toolbar {
            margin-top: 0.5rem;
            justify-content: center;
          }
          .calendar-shell .fc .fc-footer-toolbar .fc-holidays-button,
          .calendar-shell .fc .fc-footer-toolbar .fc-hebrewDate-button {
            padding-inline: 0.4rem;
          }
          .calendar-shell .fc .fc-toolbar-title,
          .calendar-shell.hebrew-on .fc .fc-toolbar-title {
            line-height: 1.2;
            text-align: center;
          }
          .calendar-shell.hebrew-on .fc .fc-toolbar-title::after {
            font-size: 0.62rem;
            line-height: 1.1;
          }
          .calendar-shell .fc-event {
            font-size: 0.72rem;
          }
          .calendar-shell .fc-month-pill {
            font-size: 0.6rem;
          }
          /* Day cells are ~50px wide: the holiday gets its own line under the
             date, two lines at most, instead of being cut to two letters */
          .calendar-shell .fc-day-top-inner {
            flex-direction: column-reverse;
            align-items: flex-end;
            gap: 0;
          }
          /* The day number keeps its corner and the Hebrew date takes the
             other one; a date that carries its month drops under the number */
          .calendar-shell .fc-day-top-inner .fc-day-num {
            align-self: stretch;
            flex-direction: row-reverse;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0 2px;
          }
          .calendar-shell .fc-day-top-inner .fc-hebdate {
            font-size: 0.6rem;
            line-height: 1.15;
            white-space: normal;
          }
          /* Week columns are ~40px: a date with its month may take two lines */
          .calendar-shell .fc-head-inner .fc-hebdate {
            font-size: 0.6rem;
            line-height: 1.15;
            white-space: normal;
            text-align: center;
          }
          .calendar-shell .fc-day-top-inner .fc-holiday {
            align-self: stretch;
            font-size: 0.52rem;
            line-height: 1.15;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .calendar-shell .fc .fc-timegrid-slot-label-cushion {
            font-size: 0.65rem;
          }
          /* Phone week: seven ~40px columns — time on one line, the name
             under it, small, broken at any letter rather than cut off */
          /* The name comes first: in a short row it is what stays visible
             (the row itself already shows the hour) */
          .calendar-shell .fc-timeGridWeek-view .fc-tg-event {
            display: flex;
            flex-direction: column;
            font-size: 0.56rem;
            line-height: 1.05;
          }
          .calendar-shell .fc-timeGridWeek-view .fc-tg-name {
            order: -1;
            font-weight: 600;
            overflow-wrap: anywhere;
          }
          .calendar-shell .fc-timeGridWeek-view .fc-tg-time {
            font-weight: 400;
            opacity: 0.9;
          }
          .calendar-shell .fc-timeGridWeek-view .fc-timegrid-event {
            padding: 0 2px;
          }
          .calendar-shell .fc .fc-col-header-cell-cushion {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}
