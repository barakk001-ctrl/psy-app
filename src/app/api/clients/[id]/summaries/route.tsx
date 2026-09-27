import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptNote } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { formatDate, formatDateTime } from "@/lib/format";
import { SummariesPDF } from "@/components/clients/summaries-pdf";
import { pdfResponse } from "@/components/pdf/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All of a client's session summaries as one PDF, oldest first.
// Middleware skips /api, so this route guards itself; every query is userId-scoped.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const [client, user] = await Promise.all([
    db.client.findFirst({
      where: { id, userId },
      select: { id: true, firstName: true, lastName: true, idNumber: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, businessName: true, brandName: true },
    }),
  ]);
  if (!client) return new Response("Not found", { status: 404 });

  const sessions = await db.session.findMany({
    where: { clientId: id, userId, note: { isNot: null } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, status: true, treatmentType: true, note: true },
  });

  const entries = sessions.map((s) => {
    let text = "";
    try {
      text = decryptNote({
        contentCiphertext: s.note!.contentCiphertext,
        contentIv: s.note!.contentIv,
        contentTag: s.note!.contentTag,
      });
    } catch {
      text = "(שגיאה בפענוח הסיכום)";
    }
    const tag = [
      s.treatmentType,
      s.status === "CANCELLED" ? "בוטלה" : s.status === "NO_SHOW" ? "לא התקיימה" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { date: formatDateTime(s.startsAt), tag, text };
  });

  await logAudit(userId, "RECORD_EXPORT", { clientId: id });

  const clientName = `${client.firstName} ${client.lastName}`.trim();
  return pdfResponse(
    <SummariesPDF
      data={{
        practiceName: user?.brandName || user?.businessName || user?.name || "",
        clientName,
        clientIdNumber: client.idNumber,
        generatedAt: formatDate(new Date()),
        entries,
      }}
    />,
    `summaries-${client.id}.pdf`,
  );
}
