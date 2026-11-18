import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm, TaskRows } from "@/components/tasks/task-list";
import { sortOpenTasks } from "@/lib/tasks";
import type { TaskView } from "@/lib/tasks-data";

/** The tasks about one client, on the client's page. */
export function ClientTasksCard({
  clientId,
  open,
  done,
  today,
  suggestions,
}: {
  clientId: string;
  open: TaskView[];
  /** the latest ones ticked */
  done: TaskView[];
  today: string;
  suggestions?: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          משימות
          {open.length > 0 && (
            <span className="text-xs font-sans font-normal text-ink-muted"> ({open.length} פתוחות)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TaskForm today={today} fixedClientId={clientId} suggestions={suggestions} />
        {open.length > 0 && <TaskRows tasks={sortOpenTasks(open)} today={today} fixedClientId={clientId} />}
        {done.length > 0 && (
          <section aria-label="משימות שבוצעו">
            <h3 className="text-xs font-medium text-ink-muted mb-0.5">בוצעו</h3>
            <TaskRows tasks={done} today={today} fixedClientId={clientId} />
          </section>
        )}
      </CardContent>
    </Card>
  );
}
