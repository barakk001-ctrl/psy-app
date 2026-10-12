import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { documentStore } from "@/lib/document-storage-pg";
import { serveClientDocument } from "@/lib/client-document-serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A client document (ClientDocument), decrypted. Only its owner gets it —
// anyone else (or a client in the recycle bin) gets 404. `?download=1` asks
// for an attachment; otherwise PDFs and images open inline and Word files
// download. Every hit is in the access log (DOCUMENT_VIEW / DOCUMENT_DOWNLOAD).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";

  const result = await serveClientDocument(session?.user?.id, id, download ? "download" : "view", {
    findDocument: (where) =>
      db.clientDocument.findFirst({
        where,
        select: { id: true, clientId: true, nameCiphertext: true, mimeType: true },
      }),
    store: documentStore,
    decryptName: decryptSecret,
    audit: logAudit,
  });

  return new Response(result.body, { status: result.status, headers: result.headers });
}
