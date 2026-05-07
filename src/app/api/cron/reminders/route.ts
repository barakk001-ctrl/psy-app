import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/reminder-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 50;

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // In dev without CRON_SECRET, allow. In prod, require it.
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  return run(req);
}

// Vercel Cron sends GET, but support POST too in case you call it from elsewhere
export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  if (!authorize(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  // Find due reminders. Limit per run so a backlog doesn't blow timeouts.
  const due = await db.reminderJob.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: MAX_BATCH,
    include: {
      session: {
        include: {
          client: true,
          user: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of due) {
    // Optimistic claim — only proceed if we successfully flip from PENDING.
    // This prevents double-sending if the cron overlaps itself.
    const claim = await db.reminderJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "SENT", sentAt: now },
    });
    if (claim.count === 0) {
      skipped++;
      continue;
    }

    const session = job.session;

    // Skip if session is no longer scheduled, or has no client email
    if (session.status !== "SCHEDULED") {
      await db.reminderJob.update({
        where: { id: job.id },
        data: {
          status: "CANCELLED",
          sentAt: null,
          error: `Session is ${session.status}`,
        },
      });
      skipped++;
      continue;
    }

    if (!session.client.email) {
      await db.reminderJob.update({
        where: { id: job.id },
        data: { status: "FAILED", sentAt: null, error: "Client has no email" },
      });
      failed++;
      continue;
    }

    const hoursBefore =
      (session.startsAt.getTime() - job.scheduledFor.getTime()) / (60 * 60 * 1000);

    const { subject, html, text } = buildReminderEmail({
      clientFirstName: session.client.firstName,
      practitionerName: session.user.businessName ?? session.user.name,
      practitionerPhone: session.user.phone,
      sessionStartsAt: session.startsAt,
      location: session.location,
      meetingUrl: session.meetingUrl,
      hoursBefore,
    });

    const result = await sendEmail({
      to: session.client.email,
      subject,
      html,
      text,
      replyTo: session.user.email,
    });

    if (result.ok) {
      // already marked SENT during claim; nothing more to do
      sent++;
    } else {
      await db.reminderJob.update({
        where: { id: job.id },
        data: { status: "FAILED", sentAt: null, error: result.error },
      });
      failed++;
    }
  }

  return Response.json({ ok: true, considered: due.length, sent, failed, skipped });
}
