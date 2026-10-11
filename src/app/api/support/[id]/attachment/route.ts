import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptBuffer } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The screenshot attached to a support request — for the operator (Settings →
 *  פניות תמיכה) or the user who sent it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const [me, request] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
    db.supportRequest.findUnique({
      where: { id },
      select: {
        userId: true,
        attachmentName: true,
        attachmentType: true,
        attachmentCiphertext: true,
        attachmentIv: true,
        attachmentTag: true,
      },
    }),
  ]);
  if (!request || (request.userId !== userId && !me?.isAdmin)) {
    return new Response("Not found", { status: 404 });
  }
  if (!request.attachmentCiphertext || !request.attachmentIv || !request.attachmentTag) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = decryptBuffer({
      ciphertext: Buffer.from(request.attachmentCiphertext),
      iv: request.attachmentIv,
      tag: request.attachmentTag,
    });
  } catch {
    return new Response("Decryption failed", { status: 500 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": request.attachmentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(request.attachmentName ?? "screenshot")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
