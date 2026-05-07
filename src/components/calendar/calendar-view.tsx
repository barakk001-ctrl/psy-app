"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import heLocale from "@fullcalendar/core/locales/he";
import type { EventInput } from "@fullcalendar/core";
import { rescheduleSessionAction } from "@/server/actions/sessions";

type Props = {
  events: EventInput[];
};

// Color sessions by status — sage for scheduled, muted for past, terracotta for problems.
const STATUS_BG: Record<string, string> = {
  SCHEDULED: "#5C7559",
  COMPLETED: "#9A8E80",
  CANCELLED: "#D4CCB9",
  NO_SHOW: "#B5654A",
};

export function CalendarView({ events }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const styledEvents: EventInput[] = events.map((e) => ({
    ...e,
    backgroundColor: STATUS_BG[(e.extendedProps?.status as string) ?? "SCHEDULED"],
    borderColor: STATUS_BG[(e.extendedProps?.status as string) ?? "SCHEDULED"],
    textColor: "#FDFBF7",
  }));

  return (
    <div className="rounded-lg bg-white border border-cream-300 shadow-soft p-4 calendar-shell">
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={heLocale}
        direction="rtl"
        firstDay={0}
        height="auto"
        headerToolbar={{
          start: "prev,next today",
          center: "title",
          end: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
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
        nowIndicator
        editable
        selectable
        selectMirror
        events={styledEvents}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          router.push(`/sessions/${info.event.id}`);
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
              await rescheduleSessionAction({
                id: info.event.id,
                startsAt: info.event.start!.toISOString(),
                endsAt: info.event.end!.toISOString(),
              });
              router.refresh();
            } catch {
              info.revert();
            }
          });
        }}
        eventResize={(info) => {
          startTransition(async () => {
            try {
              await rescheduleSessionAction({
                id: info.event.id,
                startsAt: info.event.start!.toISOString(),
                endsAt: info.event.end!.toISOString(),
              });
              router.refresh();
            } catch {
              info.revert();
            }
          });
        }}
      />

      <style jsx global>{`
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
        .calendar-shell .fc-timegrid-event-harness > .fc-timegrid-event {
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
