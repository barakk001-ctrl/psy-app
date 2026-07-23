"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clientSchema } from "@/server/validators/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type ClientFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    idNumber: formData.get("idNumber") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    address: formData.get("address") ?? "",
    defaultRate: formData.get("defaultRate") ?? "",
    generalNotes: formData.get("generalNotes") ?? "",
  });
}

export async function createClientAction(
  _: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const userId = await requireUserId();
  const parsed = parseClientForm(formData);

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const created = await db.client.create({
    data: {
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      idNumber: data.idNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      address: data.address || null,
      defaultRate: data.defaultRate ?? null,
      generalNotes: data.generalNotes || null,
    },
  });

  revalidatePath("/clients");

  // Imported-message flow: continue straight to creating the meeting
  const nextStart = String(formData.get("nextStart") ?? "");
  if (nextStart) {
    redirect(
      `/sessions/new?clientId=${created.id}&start=${encodeURIComponent(nextStart)}`,
    );
  }
  redirect(`/clients/${created.id}`);
}

export async function updateClientAction(
  _: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה לקוח חסר" };

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // Verify ownership before update
  const existing = await db.client.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return { error: "לקוח לא נמצא" };

  await db.client.update({
    where: { id, userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      idNumber: data.idNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      address: data.address || null,
      defaultRate: data.defaultRate ?? null,
      generalNotes: data.generalNotes || null,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function archiveClientAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.client.update({
    where: { id, userId },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function unarchiveClientAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.client.update({
    where: { id, userId },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
