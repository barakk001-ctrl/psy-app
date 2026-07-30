"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function addTodoAction(formData: FormData) {
  const userId = await requireUserId();
  const text = String(formData.get("text") ?? "").trim().slice(0, 300);
  if (!text) return;

  await db.todo.create({ data: { userId, text } });
  revalidatePath("/dashboard");
}

export async function toggleTodoAction(id: string) {
  const userId = await requireUserId();
  const todo = await db.todo.findFirst({
    where: { id, userId },
    select: { id: true, done: true },
  });
  if (!todo) return;

  await db.todo.update({ where: { id: todo.id }, data: { done: !todo.done } });
  revalidatePath("/dashboard");
}

export async function deleteTodoAction(id: string) {
  const userId = await requireUserId();
  await db.todo.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}
