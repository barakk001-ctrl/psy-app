import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptBuffer } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await db.sessionFile.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!file) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = decryptBuffer({
      ciphertext: Buffer.from(file.dataCiphertext),
      iv: file.dataIv,
      tag: file.dataTag,
    });
  } catch {
    return new Response("Decryption failed", { status: 500 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
