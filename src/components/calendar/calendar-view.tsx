"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  defaultMinutes?: number;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Color sessions by status — sage for scheduled, muted for past, terracotta for problems.
const STATUS_BG: Record<string, string> = {
  SCHEDULED: "#5C7559",
  COMPLETED: "#9A8E80",
  CANCELLED: "#D4CCB9",
  NO_SHOW: "#B5654A",
};

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
  defaultMinutes,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isMobile = useIsMobile();
  const [quickEdit, setQuickEdit] = useState<QuickEditData | null>(null);
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

  const styledEvents: EventInput[] = events.map((e) => {
    const status = (e.extendedProps?.status as string) ?? "SCHEDULED";
    // Scheduled events take the meeting type's color; other statuses keep
    // their signal colors (completed/cancelled/no-show).
    const typeColor =
      status === "SCHEDULED"
        ? typeColors?.[e.extendedProps?.treatmentType as string]
        : undefined;
    const bg = typeColor ?? STATUS_BG[status];
    return {
      ...e,
      backgroundColor: bg,
      borderColor: bg,
      textColor: "#FDFBF7",
    };
  });

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm border border-cream-200/80 shadow-soft p-2 sm:p-4 calendar-shell">
      <div className="calendar-grid">
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        // Force re-render when viewport changes so toolbar layout takes effect
        key={isMobile ? "mobile" : "desktop"}
        locale={heLocale}
        direction="rtl"
        firstDay={0}
        // Fill the fixed-height shell; the grid scrolls internally, not the page
        height="100%"
        headerToolbar={
          isMobile
            ? {
                start: "prev,next",
                center: "title",
                end: "holidays today",
              }
            : {
                start: "prev,next today",
                center: "title",
                end: "holidays dayGridMonth,timeGridWeek,timeGridDay",
              }
        }
        // The holidays switch lives in the toolbar rather than on a row of its
        // own: every pixel of height is a meeting more per day in month view.
        customButtons={{
          holidays: {
            text: (showHolidays ? "☑" : "☐") + " מועדי ישראל",
            hint: "הצגת מועדי ישראל ביומן",
            click: toggleHolidays,
          },
        }}
        // On mobile, let users switch views via separate buttons we render below
        footerToolbar={
          isMobile
            ? {
                center: "dayGridMonth,timeGridWeek,timeGridDay",
              }
            : undefined
        }
        buttonText={{
          today: "היום",
          month: "חודש",
          week: "שבוע",
          day: "יום",
        }}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00"
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
          return true;
        }}
        // Show only the weeks the month has (5 more often than 6) and let each
        // day hold what fits, with "+N נוספים" for the rest. A fixed 3 per day
        // made rows taller than the screen and the month scrolled inside itself.
        fixedWeekCount={false}
        dayMaxEvents
        // Holidays: a small line beside the day number (month) or under the
        // weekday (week/day), like any calendar app. Not events, so they can't
        // be dragged, clicked into the edit dialog, or counted as meetings.
        dayCellContent={(arg) => {
          if (arg.view.type !== "dayGridMonth") return undefined;
          const hs = holidayOn(arg.date);
          return (
            <span className="fc-day-top-inner">
              {hs && (
                <span className="fc-holiday" title={hs.join(" · ")}>
                  {hs.join(" · ")}
                </span>
              )}
              <span>{arg.dayNumberText}</span>
            </span>
          );
        }}
        dayHeaderContent={(arg) => {
          const hs = arg.view.type === "dayGridMonth" ? undefined : holidayOn(arg.date);
          return (
            <span className="fc-head-inner">
              <span>{arg.text}</span>
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
          color: #9a8e80;
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
          /* Footer toolbar (view switcher) on mobile */
          .calendar-shell .fc .fc-footer-toolbar {
            margin-top: 0.5rem;
            justify-content: center;
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
          .calendar-shell .fc .fc-col-header-cell-cushion {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}
