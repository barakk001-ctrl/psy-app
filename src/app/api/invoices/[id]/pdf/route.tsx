import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { loadInvoicePdfData } from "@/lib/invoice-pdf-data";
import { InvoicePDF, ensureFontsRegistered } from "@/components/invoices/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const loaded = await loadInvoicePdfData(id, session.user.id);
  if (!loaded) return new Response("Not found", { status: 404 });
  const { invoice, data } = loaded;

  let nodeStream;
  try {
    ensureFontsRegistered();
    nodeStream = await renderToStream(<InvoicePDF data={data} />);
  } catch (err) {
    console.error("PDF render failed:", err);
    return new Response(
      `PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  }

  // Convert Node Readable → Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err: Error) => {
        console.error("PDF stream error:", err);
        controller.error(err);
      });
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
