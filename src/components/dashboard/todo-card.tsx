"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addTodoAction,
  deleteTodoAction,
  toggleTodoAction,
} from "@/server/actions/todos";

export type TodoItem = { id: string; text: string; done: boolean };

export function TodoCard({ todos }: { todos: TodoItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function toggle(id: string) {
    startTransition(async () => {
      await toggleTodoAction(id);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTodoAction(id);
      router.refresh();
    });
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-sage-600" />
          משימות
          {open.length > 0 && (
            <span className="text-xs font-sans font-normal text-ink-muted">
              ({open.length} פתוחות)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          ref={formRef}
          action={async (formData) => {
            await addTodoAction(formData);
            formRef.current?.reset();
            router.refresh();
          }}
          className="flex items-center gap-2"
        >
          <Input
            name="text"
            placeholder="משימה חדשה…"
            maxLength={300}
            className="h-10"
            required
          />
          <button
            type="submit"
            aria-label="הוספת משימה"
            className="shrink-0 h-10 w-10 rounded-xl bg-sage-600 text-cream-50 grid place-items-center hover:bg-sage-700 transition-colors active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {todos.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-3">
            אין משימות — אפשר לנשום 🙂
          </p>
        ) : (
          <ul className="space-y-1">
            {[...open, ...done].map((t) => (
              <li key={t.id} className="group flex items-center gap-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-label={t.done ? "החזרה למשימות פתוחות" : "סימון כבוצע"}
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-md border grid place-items-center transition-colors",
                    t.done
                      ? "bg-sage-600 border-sage-600 text-cream-50"
                      : "border-cream-400 hover:border-sage-500 bg-white",
                  )}
                >
                  {t.done && <Check className="w-3.5 h-3.5" />}
                </button>
                <span
                  className={cn(
                    "flex-1 min-w-0 text-sm break-words",
                    t.done ? "text-ink-subtle line-through" : "text-ink-soft",
                  )}
                >
                  {t.text}
                </span>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="מחיקת משימה"
                  className="shrink-0 p-1 text-ink-subtle hover:text-terracotta-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
