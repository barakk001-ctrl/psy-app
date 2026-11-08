import { documentsOffResponse } from "@/lib/features-server";
import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { loadDocumentPdfData, loadInvoicePdfData } from "@/lib/invoice-pdf-data";
import { InvoicePDF, renderPdf } from "@/components/invoices/invoice-pdf";
import { DocumentPDF } from "@/components/invoices/document-pdf";
import { pdfResponse } from "@/components/pdf/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Hidden until documents can be issued (src/lib/features.ts)
  const off = documentsOffResponse();
  if (off) return off;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  // A "מסמך חדש" document: the same layout as its preview
  const doc = await loadDocumentPdfData(id, session.user.id);
  if (doc) {
    return pdfResponse(<DocumentPDF data={doc.data} />, `document-${doc.invoice.number}.pdf`);
  }

  const loaded = await loadInvoicePdfData(id, session.user.id);
  if (!loaded) return new Response("Not found", { status: 404 });
  const { invoice, data } = loaded;

  let nodeStream;
  try {
    nodeStream = await renderPdf(() => renderToStream(<InvoicePDF data={data} />));
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
