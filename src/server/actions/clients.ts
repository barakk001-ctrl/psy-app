"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, dbAll } from "@/lib/db";
import { subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";
import { cancelSessionReminders, scheduleSessionReminders } from "@/lib/reminders";
import {
  blockersText,
  clientDeletionDecision,
  deletionContentsText,
} from "@/lib/client-trash";
import { loadDeletionFacts, purgeClient } from "@/lib/client-trash-data";
import {
  closeClientOpenSeries,
  keepSeriesLinked,
  loadDeactivationPlan,
} from "@/lib/session-scope";
import {
  deactivationCount,
  deactivationNotice,
  needsDeactivationConfirm,
  type DeactivationPlan,
} from "@/lib/client-deactivation";
import type { Prisma } from "@prisma/client";

import { clientSchema, clientStatusSchema } from "@/server/validators/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type ClientFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** switching to "לא פעיל" would take meetings off the calendar — ask first */
  deactivate?: DeactivationConfirm;
} | null;

/** What the practitioner is asked before a client is marked inactive. */
export type DeactivationConfirm = { count: number; notice: string };

/** The count the practitioner approved (sent back with the confirmed submit). */
function confirmedCount(formData: FormData): number | null {
  const raw = formData.get("confirmDeactivate");
  if (typeof raw !== "string" || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Saves the client and, when they are being marked inactive, takes their
 * future meetings off the calendar in the same transaction (the rules are in
 * client-deactivation.ts): empty ones deleted, ones holding records cancelled,
 * open-ended series closed so the cron never extends them again.
 */
async function saveClient(
  userId: string,
  clientId: string,
  data: Prisma.ClientUpdateInput,
  plan: DeactivationPlan | null,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.client.update({ where: { id: clientId, userId }, data });
    if (!plan) return;
    // Deleting a series' first meeting must not cut the rest loose
    await keepSeriesLinked(tx, userId, plan.deleteIds);
    if (plan.cancelIds.length) {
      await tx.session.updateMany({
        where: { userId, clientId, id: { in: plan.cancelIds }, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      });
    }
    if (plan.deleteIds.length) {
      // Reminder jobs of deleted meetings go with them (ON DELETE CASCADE)
      await tx.session.deleteMany({ where: { userId, clientId, id: { in: plan.deleteIds } } });
    }
    await closeClientOpenSeries(tx, userId, clientId);
  });
  if (!plan) return;
  for (const id of plan.cancelIds) await cancelSessionReminders(id);
  if (deactivationCount(plan) > 0) {
    await logAudit(userId, "SESSIONS_BULK_DELETE", { clientId });
  }
}

/** Query string for the client card's "removed from the calendar" notice. */
function resultParams(plan: DeactivationPlan | null): string {
  if (!plan || deactivationCount(plan) === 0) return "";
  const why = [...new Set(plan.keep.flatMap((k) => k.reasons))].join(",");
  return `?${new URLSearchParams({
    futureDeleted: String(plan.deleteIds.length),
    futureKept: String(plan.cancelIds.length),
    ...(why ? { keptWhy: why } : {}),
  })}`;
}

function revalidateClient(id: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    status: formData.get("status") ?? undefined,
    treatmentType: formData.get("treatmentType") ?? "טיפול פרטני",
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
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
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
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
      treatmentType: data.treatmentType,
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
    select: { id: true, status: true },
  });
  if (!existing) return { error: "לקוח לא נמצא" };

  // Active → inactive takes the future meetings off the calendar; ask first
  let plan: DeactivationPlan | null = null;
  if (data.status === "INACTIVE" && existing.status === "ACTIVE") {
    plan = await loadDeactivationPlan(userId, id);
    if (needsDeactivationConfirm(plan, confirmedCount(formData))) {
      return {
        deactivate: { count: deactivationCount(plan), notice: deactivationNotice(plan)! },
      };
    }
  }

  await saveClient(
    userId,
    id,
    {
      firstName: data.firstName,
      lastName: data.lastName,
      idNumber: data.idNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      address: data.address || null,
      defaultRate: data.defaultRate ?? null,
      generalNotes: data.generalNotes || null,
      treatmentType: data.treatmentType,
      ...(data.status ? { status: data.status } : {}),
    },
    plan,
  );

  revalidateClient(id);
  redirect(`/clients/${id}${resultParams(plan)}`);
}

export type ClientStatusResult =
  | { done: true; /** query string for the card's result notice ("" = none) */ result: string }
  | { confirm: DeactivationConfirm }
  | undefined;

/** פעיל / לא פעיל — the toggle on the client card and the clients list.
 *  Inactive clients keep their history (past meetings, summaries, invoices),
 *  but their future meetings leave the calendar: switching active → inactive
 *  first returns `confirm` with the counts when there are any, and only a
 *  resubmit carrying `confirmDeactivate` (the approved count) applies it.
 *  Reactivating changes nothing on the calendar — she books again. */
export async function setClientStatusAction(formData: FormData): Promise<ClientStatusResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = clientStatusSchema.safeParse(formData.get("status"));
  if (!id || !parsed.success) return;

  const existing = await db.client.findFirst({
    where: { id, userId },
    select: { status: true },
  });
  if (!existing) return;

  let plan: DeactivationPlan | null = null;
  if (parsed.data === "INACTIVE" && existing.status === "ACTIVE") {
    plan = await loadDeactivationPlan(userId, id);
    if (needsDeactivationConfirm(plan, confirmedCount(formData))) {
      return { confirm: { count: deactivationCount(plan), notice: deactivationNotice(plan)! } };
    }
  }

  await saveClient(userId, id, { status: parsed.data }, plan);
  revalidateClient(id);
  return { done: true, result: resultParams(plan) };
}

// ─────────────────────────────────────────────────────────────
// Deleting a client — the recycle bin (סל מחזור). Rules: lib/client-trash.ts.
// ─────────────────────────────────────────────────────────────

export type ClientDeletionPreview =
  | { error: string }
  | {
      name: string;
      allowed: false;
      /** must be made inactive first */
      active: boolean;
      /** "חשבוניות שהופקו באפליקציה ורישומי תשלום בפגישות" */
      blockers: string;
    }
  | {
      name: string;
      allowed: true;
      /** "יחד עם התיק יימחקו: 3 פגישות, 2 סיכומים…" */
      contents: string;
      /** the record holds summaries or attachments — show the legal note */
      clinicalWarning: boolean;
    };

/** Read-only: what deleting this client would remove, or why it can't be
 *  deleted. `inTrash` = the permanent "delete now" from the recycle bin. */
export async function clientDeletionPreviewAction(
  clientId: string,
  inTrash = false,
): Promise<ClientDeletionPreview> {
  const userId = await requireUserId();
  if (typeof clientId !== "string" || !clientId) return { error: "לקוח לא נמצא" };
  const facts = await loadDeletionFacts(userId, clientId, inTrash === true);
  if (!facts) return { error: "לקוח לא נמצא" };
  const decision = inTrash
    ? ({ allowed: true, clinicalWarning: facts.notes > 0 || facts.files > 0 } as const)
    : clientDeletionDecision(facts);
  if (!decision.allowed) {
    return {
      name: facts.name,
      allowed: false,
      active: decision.blockers.includes("active"),
      blockers: blockersText(decision.blockers),
    };
  }
  return {
    name: facts.name,
    allowed: true,
    contents: deletionContentsText(facts),
    clinicalWarning: decision.clinicalWarning,
  };
}

export type TrashResult = { error?: string; done?: boolean } | undefined;

function revalidateEverywhere() {
  // A deleted/restored client shows up (or not) on almost every page
  revalidatePath("/", "layout");
}

/** Moves an inactive client without tax records to the recycle bin for
 *  TRASH_DAYS: hidden everywhere, pending reminders cancelled. */
export async function trashClientAction(formData: FormData): Promise<TrashResult> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה לקוח חסר" };

  const facts = await loadDeletionFacts(userId, id, false);
  if (!facts) return { error: "לקוח לא נמצא" };
  const decision = clientDeletionDecision(facts);
  if (!decision.allowed) {
    return {
      error: decision.blockers.includes("active")
        ? "אפשר למחוק רק לקוח/ה לא פעיל/ה. העבירו קודם ל״לא פעילים״."
        : `אי אפשר למחוק: יש בתיק ${blockersText(decision.blockers)}, שחייבים להישמר לפי דיני המס.`,
    };
  }

  const moved = await db.$transaction(async (tx) => {
    const { count } = await tx.client.updateMany({
      where: { id, userId, deletedAt: null, status: "INACTIVE" },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return false;
    // No reminder may go out for a deleted client's meetings
    await tx.reminderJob.updateMany({
      where: { userId, status: "PENDING", session: { clientId: id } },
      data: { status: "CANCELLED", error: "Client deleted" },
    });
    return true;
  });
  if (!moved) return { error: "לקוח לא נמצא" };
  await logAudit(userId, "CLIENT_TRASH", { clientId: id });

  revalidateEverywhere();
  return { done: true };
}

/** Back from the recycle bin exactly as it was (inactive), reminders of any
 *  future scheduled meetings set up again. */
export async function restoreClientAction(formData: FormData): Promise<TrashResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה לקוח חסר" };

  const { count } = await dbAll.client.updateMany({
    where: { id, userId, deletedAt: { not: null } },
    data: { deletedAt: null, status: "INACTIVE" },
  });
  if (count === 0) return { error: "הלקוח/ה כבר לא בסל המחזור" };

  const upcoming = await db.session.findMany({
    where: { userId, clientId: id, status: "SCHEDULED", startsAt: { gt: new Date() } },
    select: { id: true },
  });
  for (const s of upcoming) await scheduleSessionReminders(s.id);
  await logAudit(userId, "CLIENT_RESTORE", { clientId: id });

  revalidateEverywhere();
  return { done: true };
}

/** "מחיקה לצמיתות עכשיו" from the recycle bin — no waiting for the 30 days. */
export async function purgeClientNowAction(formData: FormData): Promise<TrashResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה לקוח חסר" };
  if (!(await purgeClient(userId, id))) return { error: "הלקוח/ה כבר לא בסל המחזור" };
  revalidateEverywhere();
  return { done: true };
}
