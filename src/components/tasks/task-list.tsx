"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientCombobox, type ClientComboboxTexts } from "@/components/ui/client-combobox";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/scheduling-window";
import type { ClientChoice } from "@/lib/follow-up-filters";
import type { TaskView } from "@/lib/tasks-data";
import {
  TASK_GROUP_LABELS,
  TASK_NOTE_MAX,
  TASK_SUGGESTIONS,
  TASK_TITLE_MAX,
  dueText,
  taskBucket,
  type TaskBucket,
  type TaskGroups,
} from "@/lib/tasks";
import {
  addTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  updateTaskAction,
  type TaskFormState,
} from "@/server/actions/tasks";

const CLIENT_TEXTS: ClientComboboxTexts = {
  none: "ללא לקוח/ה",
  placeholder: "לקוח/ה (לא חובה) — הקלידו שם",
  label: "הלקוח/ה שהמשימה נוגעת אליו/ה",
  clear: "הסרת הלקוח/ה מהמשימה",
};

/** What every task list needs to know about its surroundings. */
type Surroundings = {
  /** today on the clinic calendar, "yyyy-MM-dd" */
  today: string;
  /** the practice's clients, for the picker; not needed on a client's own page */
  clients?: ClientChoice[];
  /** on a client's page: every task here is about this client */
  fixedClientId?: string;
  /** the starting titles, in the practice's own order (taskSuggestionsFor) */
  suggestions?: readonly string[];
};

const firstError = (state: TaskFormState): string | null => {
  if (!state?.error) return null;
  const fields = Object.values(state.fieldErrors ?? {}).flat();
  return fields[0] ?? state.error;
};

/**
 * Adds a task, or edits one (`task`). Adding starts as a single line; typing
 * or tapping into it opens the starting titles, the day, the client and the note.
 */
export function TaskForm({
  task,
  today,
  clients = [],
  fixedClientId,
  suggestions = TASK_SUGGESTIONS,
  onClose,
}: Surroundings & {
  task?: TaskView;
  /** edit mode: called after saving, deleting or cancelling */
  onClose?: () => void;
}) {
  const editing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [dueDay, setDueDay] = useState(task?.dueDay ?? "");
  const [clientId, setClientId] = useState<string | null>(fixedClientId ?? task?.client?.id ?? null);
  const [open, setOpen] = useState(editing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  const quickDays = [
    { label: "היום", day: today },
    { label: "מחר", day: addDays(today, 1) },
    { label: "בעוד שבוע", day: addDays(today, 7) },
  ];

  function reset() {
    setTitle("");
    setNote("");
    setDueDay("");
    setClientId(fixedClientId ?? null);
    setError(null);
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    const data = new FormData();
    if (task) data.set("id", task.id);
    data.set("title", title);
    data.set("note", note);
    data.set("dueDay", dueDay);
    data.set("clientId", clientId ?? "");
    startTransition(async () => {
      const state = task ? await updateTaskAction(null, data) : await addTaskAction(null, data);
      const problem = firstError(state);
      if (problem) {
        setError(problem);
        return;
      }
      if (task) onClose?.();
      else reset();
    });
  }

  function remove() {
    if (!task || pending) return;
    if (!window.confirm("למחוק את המשימה?")) return;
    startTransition(async () => {
      const problem = firstError(await deleteTaskAction(task.id));
      if (problem) setError(problem);
      else onClose?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // after adding with Enter the line keeps the focus, so a tap must open it too
          onClick={() => setOpen(true)}
          placeholder="משימה חדשה…"
          aria-label={editing ? "שם המשימה" : "משימה חדשה"}
          maxLength={TASK_TITLE_MAX}
          className="h-10"
          autoFocus={editing}
        />
        {!open && (
          <button
            type="button"
            onClick={() => titleRef.current?.focus()}
            aria-label="הוספת משימה"
            className="shrink-0 h-10 w-10 rounded-xl bg-sage-600 text-cream-50 grid place-items-center hover:bg-sage-700 transition-colors active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {open && (
        <>
          {!editing && !title.trim() && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="הצעות לשם המשימה">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setTitle(s);
                    // ready to go on typing after the suggested words
                    requestAnimationFrame(() => {
                      const el = titleRef.current;
                      if (!el) return;
                      el.focus();
                      el.setSelectionRange(s.length, s.length);
                    });
                  }}
                  className="px-2.5 py-1 rounded-full border border-cream-300 bg-white/70 text-xs text-ink-soft hover:border-sage-500 hover:text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">לתאריך:</span>
            {quickDays.map((q) => (
              <button
                key={q.label}
                type="button"
                aria-pressed={dueDay === q.day}
                onClick={() => setDueDay(dueDay === q.day ? "" : q.day)}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-xs transition-colors",
                  dueDay === q.day
                    ? "border-sage-600 bg-sage-600 text-cream-50"
                    : "border-cream-300 bg-white/70 text-ink-soft hover:border-sage-500",
                )}
              >
                {q.label}
              </button>
            ))}
            <Input
              type="date"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              aria-label="תאריך היעד של המשימה"
              className="h-8 w-auto px-2 text-xs"
            />
            {dueDay && (
              <button
                type="button"
                onClick={() => setDueDay("")}
                aria-label="הסרת התאריך"
                title="הסרת התאריך"
                className="w-7 h-7 rounded-full grid place-items-center text-ink-muted hover:bg-cream-200 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!fixedClientId && (
            <ClientCombobox clients={clients} value={clientId} onChange={setClientId} texts={CLIENT_TEXTS} />
          )}

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הערה (לא חובה)"
            aria-label="הערה למשימה"
            maxLength={TASK_NOTE_MAX}
            className="min-h-[64px] text-sm"
          />

          {error && (
            <p role="alert" className="text-sm text-terracotta-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending || !title.trim()}>
              {editing ? "שמירה" : "הוספה"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={editing ? onClose : reset}>
              ביטול
            </Button>
            {editing && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="ms-auto inline-flex items-center gap-1.5 text-sm text-terracotta-600 hover:underline disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                מחיקה
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}

const DUE_STYLES: Record<TaskBucket, string> = {
  overdue: "bg-terracotta-500/10 text-terracotta-600",
  today: "bg-gold-200 text-ink-soft",
  upcoming: "bg-cream-200 text-ink-muted",
  none: "",
};

function TaskRow({ task, today, clients, fixedClientId }: Surroundings & { task: TaskView }) {
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(task.done);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    const before = done;
    setDone(!before);
    setError(null);
    startTransition(async () => {
      const problem = firstError(await toggleTaskAction(task.id));
      if (problem) {
        setDone(before);
        setError(problem);
      }
    });
  }

  if (editing) {
    return (
      <li className="py-2">
        <div className="rounded-xl border border-cream-300 bg-white/60 p-3">
          <TaskForm
            task={task}
            today={today}
            clients={clients}
            fixedClientId={fixedClientId}
            onClose={() => setEditing(false)}
          />
        </div>
      </li>
    );
  }

  const bucket = taskBucket(task.dueDay, today);
  return (
    <li className={cn("flex items-start gap-2.5 py-2", pending && "opacity-60")}>
      <button
        type="button"
        onClick={toggle}
        aria-label={done ? `החזרה למשימות הפתוחות: ${task.title}` : `סימון כבוצעה: ${task.title}`}
        aria-pressed={done}
        className={cn(
          "shrink-0 mt-0.5 w-5 h-5 rounded-md border grid place-items-center transition-colors",
          done ? "bg-sage-600 border-sage-600 text-cream-50" : "border-cream-400 hover:border-sage-500 bg-white",
        )}
      >
        {done && <Check className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm break-words", done ? "text-ink-subtle line-through" : "text-ink")}>{task.title}</p>
        {(task.dueDay || (task.client && !fixedClientId)) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            {task.dueDay && !done && (
              <span className={cn("px-2 py-0.5 rounded-full", DUE_STYLES[bucket])}>{dueText(task.dueDay, today)}</span>
            )}
            {task.client && !fixedClientId && (
              <Link href={`/clients/${task.client.id}`} className="hover:text-ink hover:underline">
                {task.client.name}
              </Link>
            )}
          </p>
        )}
        {task.note && !done && (
          <p className="mt-1 text-xs text-ink-muted whitespace-pre-wrap break-words line-clamp-3">{task.note}</p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-terracotta-600">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`עריכת המשימה: ${task.title}`}
        title="עריכה"
        className="shrink-0 p-1.5 -m-1 rounded-lg text-ink-subtle hover:text-ink hover:bg-cream-200/70"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </li>
  );
}

/** A plain list of tasks, in the order given. */
export function TaskRows({ tasks, ...around }: Surroundings & { tasks: TaskView[] }) {
  return (
    <ul className="divide-y divide-cream-200/70">
      {tasks.map((t) => (
        // done is part of the key so a row re-reads its state when it moves between lists
        <TaskRow key={`${t.id}:${t.done}`} task={t} {...around} />
      ))}
    </ul>
  );
}

const GROUP_ORDER: TaskBucket[] = ["overdue", "today", "upcoming", "none"];

/** Open tasks under "באיחור / היום / בהמשך / ללא תאריך"; a group with nothing in it is left out. */
export function TaskSections({
  groups,
  labels,
  ...around
}: Surroundings & {
  groups: TaskGroups<TaskView>;
  /** other headings for some groups (the dashboard shows only the coming week) */
  labels?: Partial<Record<TaskBucket, string>>;
}) {
  return (
    <div className="space-y-4">
      {GROUP_ORDER.filter((b) => groups[b].length > 0).map((b) => (
        <section key={b} aria-label={labels?.[b] ?? TASK_GROUP_LABELS[b]}>
          <h3
            className={cn(
              "text-xs font-medium mb-0.5",
              b === "overdue" ? "text-terracotta-600" : "text-ink-muted",
            )}
          >
            {labels?.[b] ?? TASK_GROUP_LABELS[b]}
            <span className="font-normal"> ({groups[b].length})</span>
          </h3>
          <TaskRows tasks={groups[b]} {...around} />
        </section>
      ))}
    </div>
  );
}
