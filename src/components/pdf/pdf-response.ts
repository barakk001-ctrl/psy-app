import type { ReactElement } from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { ensureFontsRegistered } from "@/components/invoices/invoice-pdf";

/** Renders a react-pdf document to a streamed, private, inline PDF response. */
export async function pdfResponse(
  doc: ReactElement<DocumentProps>,
  fileName: string,
): Promise<Response> {
  let nodeStream;
  try {
    ensureFontsRegistered();
    nodeStream = await renderToStream(doc);
  } catch (err) {
    console.error("PDF render failed:", err);
    return new Response("PDF render failed", { status: 500 });
  }

  // Node Readable → Web ReadableStream
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
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
