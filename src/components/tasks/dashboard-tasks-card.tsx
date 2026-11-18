import Link from "next/link";
import { ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm, TaskRows, TaskSections } from "@/components/tasks/task-list";
import { dashboardTasks } from "@/lib/tasks";
import type { ClientChoice } from "@/lib/follow-up-filters";
import type { TaskView } from "@/lib/tasks-data";

/**
 * The dashboard box: what is overdue, due today and due in the coming week,
 * then the tasks with no day. Later ones, and the rest past the limit, are on
 * /tasks. Tasks ticked today stay at the bottom, so a slip can be undone.
 */
export function DashboardTasksCard({
  open,
  doneToday,
  clients,
  today,
}: {
  open: TaskView[];
  doneToday: TaskView[];
  clients: ClientChoice[];
  today: string;
}) {
  const { groups, hidden } = dashboardTasks(open, today);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-sage-600" />
          משימות
          {open.length > 0 && (
            <span className="text-xs font-sans font-normal text-ink-muted">({open.length} פתוחות)</span>
          )}
        </CardTitle>
        <Link href="/tasks" className="text-sm text-sage-700 hover:underline">
          לכל המשימות
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <TaskForm today={today} clients={clients} />

        {open.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">אין משימות פתוחות.</p>
        ) : (
          <TaskSections
            groups={groups}
            today={today}
            clients={clients}
            labels={{ upcoming: "בשבוע הקרוב" }}
          />
        )}

        {hidden > 0 && (
          <Link href="/tasks" className="block text-sm text-sage-700 hover:underline">
            {hidden === 1 ? "ועוד משימה אחת" : `ועוד ${hidden} משימות`}
          </Link>
        )}

        {doneToday.length > 0 && (
          <section aria-label="בוצעו היום">
            <h3 className="text-xs font-medium text-ink-muted mb-0.5">בוצעו היום</h3>
            <TaskRows tasks={doneToday} today={today} clients={clients} />
          </section>
        )}
      </CardContent>
    </Card>
  );
}
