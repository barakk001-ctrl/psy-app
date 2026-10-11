"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptBuffer } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import {
  SUPPORT_RATE_LIMIT,
  SUPPORT_SAVED_NOT_EMAILED_MESSAGE,
  SUPPORT_SUCCESS_MESSAGE,
  checkAttachment,
  sanitizePagePath,
  submitSupportRequest,
} from "@/lib/support-request";
import { emailSupportRequest, recordSupportEmail } from "@/lib/support-data";
import { supportRequestSchema } from "@/server/validators/support";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SupportFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Saved; `emailed` says whether the email to support went out too */
  done?: { emailed: boolean; message: string };
} | null;

/**
 * "פנייה לתמיכה" from the help widget. Stores the request (always first), then
 * emails it to SUPPORT_EMAIL; when the email fails the request stays saved,
 * the maintenance job retries it, and the user is told exactly that.
 * Nothing from the practice's records is added — only what was typed here.
 */
export async function submitSupportRequestAction(
  _: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const userId = await requireUserId();

  const parsed = supportRequestSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    pagePath: formData.get("pagePath") ?? "",
  });
  if (!parsed.success) {
    return { error: "נא לתקן את השדות המסומנים", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Optional screenshot: checked by size, declared type and the bytes themselves
  const file = formData.get("attachment");
  let attachment: { name: string; type: string; size: number; data: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    const data = Buffer.from(await file.arrayBuffer());
    const check = checkAttachment({ name: file.name, type: file.type, size: file.size }, data);
    if (!check.ok) return { error: check.error, fieldErrors: { attachment: [check.error] } };
    attachment = { name: check.name, type: check.type, size: file.size, data };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const byUser = rateLimit(`support:user:${userId}`, SUPPORT_RATE_LIMIT);
  const byIp = rateLimit(`support:ip:${ip}`, SUPPORT_RATE_LIMIT);
  if (!byUser.allowed || !byIp.allowed) {
    return { error: "נשלחו כמה פניות ברצף — אפשר לשלוח שוב בעוד כשעה" };
  }

  const input = parsed.data;
  try {
    const result = await submitSupportRequest({
      save: async () => {
        const encrypted = attachment ? encryptBuffer(attachment.data) : null;
        return db.supportRequest.create({
          data: {
            userId,
            name: input.name,
            email: input.email.toLowerCase(),
            phone: input.phone || null,
            subject: input.subject,
            message: input.message,
            pagePath: sanitizePagePath(input.pagePath),
            userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
            ...(attachment && encrypted
              ? {
                  attachmentName: attachment.name,
                  attachmentType: attachment.type,
                  attachmentSize: attachment.size,
                  attachmentCiphertext: new Uint8Array(encrypted.ciphertext),
                  attachmentIv: encrypted.iv,
                  attachmentTag: encrypted.tag,
                }
              : {}),
          },
          select: { id: true },
        });
      },
      send: emailSupportRequest,
      recordEmail: recordSupportEmail,
    });
    revalidatePath("/settings");
    return {
      done: {
        emailed: result.emailed,
        message: result.emailed ? SUPPORT_SUCCESS_MESSAGE : SUPPORT_SAVED_NOT_EMAILED_MESSAGE,
      },
    };
  } catch (err) {
    console.error("Support request could not be saved:", err);
    return { error: "לא הצלחנו לשמור את הפנייה. נא לנסות שוב בעוד רגע." };
  }
}

async function requireAdminId(): Promise<string> {
  const userId = await requireUserId();
  const me = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!me?.isAdmin) throw new Error("Forbidden");
  return userId;
}

/** Operator only (Settings → פניות תמיכה): mark a request handled / reopen it. */
export async function setSupportRequestStatusAction(formData: FormData): Promise<void> {
  await requireAdminId();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "DONE" ? "DONE" : "OPEN";
  if (!id) return;
  await db.supportRequest.updateMany({ where: { id }, data: { status } });
  revalidatePath("/settings");
}
