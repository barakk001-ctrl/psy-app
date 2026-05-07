"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businessInfoSchema } from "@/server/validators/settings";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  saved?: boolean;
} | null;

export async function updateBusinessInfoAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = businessInfoSchema.safeParse({
    name: formData.get("name"),
    businessName: formData.get("businessName") ?? "",
    businessId: formData.get("businessId") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    defaultRate: formData.get("defaultRate") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      businessName: data.businessName || null,
      businessId: data.businessId || null,
      address: data.address || null,
      phone: data.phone || null,
      defaultRate: data.defaultRate ?? null,
    },
  });

  revalidatePath("/settings");
  return { saved: true };
}
