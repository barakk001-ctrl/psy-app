import { Readable } from "node:stream";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import {
  buildExportEntries,
  consumeExportGrant,
  tryStartExport,
  whenFinished,
  zipStream,
} from "@/lib/account-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The full account export as a ZIP. The password or code was checked by
// prepareAccountExportAction, which left a one-time grant; this spends it. A
// POST so the grant never lands in a URL or a log. Stays open for expired
// accounts, and for closed ones in their grace period: a practice's data is
// always its own to take.

/** Back to Settings with a reason: this answers a browser's form post. */
const back = (reason: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: `/settings?export=${reason}#account-data` },
  });

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData().catch(() => null);
  const grant = form?.get("grant");
  if (typeof grant !== "string" || !grant) return back("expired");

  const release = tryStartExport(userId);
  if (!release) return back("busy");

  try {
    if (!(await consumeExportGrant(userId, grant))) {
      release();
      return back("expired");
    }
    await logAudit(userId, "ACCOUNT_EXPORT");

    const stream = zipStream(await buildExportEntries(userId));
    whenFinished(stream, release);
    const name = `mirpaa-export-${new Date().toISOString().slice(0, 10)}.zip`;
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    release();
    console.error("Account export failed:", err instanceof Error ? err.message.split("\n")[0] : "unknown");
    return back("failed");
  }
}
