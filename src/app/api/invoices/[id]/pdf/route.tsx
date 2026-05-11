import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  InvoicePDF,
  ensureFontsRegistered,
  type InvoicePDFData,
} from "@/components/invoices/invoice-pdf";

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

  const invoice = await db.invoice.findFirst({
    where: { id, userId: session.user.id },
    include: {
      client: true,
      user: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!invoice) return new Response("Not found", { status: 404 });

  const data: InvoicePDFData = {
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    notes: invoice.notes,
    business: {
      name: invoice.user.businessName ?? invoice.user.name,
      businessId: invoice.user.businessId,
      address: invoice.user.address,
      phone: invoice.user.phone,
      email: invoice.user.email,
    },
    client: {
      firstName: invoice.client.firstName,
      lastName: invoice.client.lastName,
      idNumber: invoice.client.idNumber,
      address: invoice.client.address,
      email: invoice.client.email,
      phone: invoice.client.phone,
    },
    items: invoice.items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      amount: Number(it.amount),
    })),
    payments: invoice.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt,
      reference: p.reference,
    })),
  };

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
