import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { serveClientDocument } from "@/lib/client-document-serve";
import { expenseStore } from "@/lib/expense-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An expense's file, decrypted, by the same rules as a client document: only
// its owner gets it, anyone else gets 404. `?download=1` asks for an
// attachment. Business records, not clinical, so not in the access log.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";

  const result = await serveClientDocument(session?.user?.id, id, download ? "download" : "view", {
    findDocument: async (where) => {
      const row = await db.expense.findFirst({
        where,
        select: { id: true, nameCiphertext: true, mimeType: true },
      });
      return row ? { ...row, clientId: "" } : null;
    },
    store: expenseStore,
    decryptName: decryptSecret,
    audit: async () => undefined,
  });

  return new Response(result.body, { status: result.status, headers: result.headers });
}
