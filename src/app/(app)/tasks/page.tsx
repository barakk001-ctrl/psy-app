import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm, TaskRows, TaskSections } from "@/components/tasks/task-list";
import { groupTasks } from "@/lib/tasks";
import { loadDoneTasks, loadOpenTasks, loadTaskClients, loadTaskSuggestions } from "@/lib/tasks-data";
import { toZonedDateTimeLocal } from "@/lib/timezone";
import { sayFor } from "@/lib/client-word-server";

export const metadata: Metadata = { title: "משימות" };

const DONE_SHOWN = 50;

/** Every open task of the practice, across clients, and the latest ones done. */
export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const say = await sayFor(userId);

  const today = toZonedDateTimeLocal(new Date()).slice(0, 10);
  const [open, done, clients, suggestions] = await Promise.all([
    loadOpenTasks(userId),
    loadDoneTasks(userId, { take: DONE_SHOWN }),
    loadTaskClients(userId),
    loadTaskSuggestions(userId),
  ]);
  const groups = groupTasks(open, today);

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl text-ink">משימות</h1>
        <p className="text-ink-muted mt-1 text-sm">
          {say("מה שצריך לעשות מחוץ לפגישות: שיחות, תיאומים, דוחות ומעקב. אפשר לשייך משימה ללקוח/ה ולקבוע לה תאריך.")}
        </p>
      </header>

      <Card>
        <CardContent>
          <TaskForm today={today} clients={clients} suggestions={suggestions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            פתוחות
            {open.length > 0 && <span className="text-xs font-sans font-normal text-ink-muted"> ({open.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-3">אין משימות פתוחות.</p>
          ) : (
            <TaskSections groups={groups} today={today} clients={clients} />
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>בוצעו</CardTitle>
            {done.length === DONE_SHOWN && (
              <p className="text-sm text-ink-muted mt-1">מוצגות {DONE_SHOWN} האחרונות.</p>
            )}
          </CardHeader>
          <CardContent>
            <TaskRows tasks={done} today={today} clients={clients} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
