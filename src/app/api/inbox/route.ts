import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inbound message API: iOS Shortcuts, automations, and email webhooks POST
// free text here; it lands in the user's inbox for processing on /import.
// Auth: personal token (Settings) via Authorization: Bearer or ?token=.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || url.searchParams.get("token") || "";
  if (!token) return Response.json({ ok: false, error: "Missing token" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { inboxToken: token },
    select: { id: true },
  });
  if (!user) return Response.json({ ok: false, error: "Invalid token" }, { status: 401 });

  const limited = rateLimit(`inbox:${user.id}`, { limit: 60, windowMs: 60 * 60_000 });
  if (!limited.allowed) {
    return Response.json({ ok: false, error: "Rate limited" }, { status: 429 });
  }

  // Accept JSON {message} / {text} or a raw text body
  let text = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { message?: string; text?: string };
      text = String(body.message ?? body.text ?? "");
    } else {
      text = await req.text();
    }
  } catch {
    return Response.json({ ok: false, error: "Unreadable body" }, { status: 400 });
  }

  text = text.trim().slice(0, 5000);
  if (!text) return Response.json({ ok: false, error: "Empty message" }, { status: 400 });

  await db.inboxMessage.create({ data: { userId: user.id, text } });
  return Response.json({ ok: true });
}
