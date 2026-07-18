import { renderToBuffer } from "@react-pdf/renderer";
import {
  InvoicePDF,
  ensureFontsRegistered,
  type InvoicePDFData,
} from "@/components/invoices/invoice-pdf";

export async function renderInvoicePdfBuffer(data: InvoicePDFData): Promise<Buffer> {
  ensureFontsRegistered();
  return Buffer.from(await renderToBuffer(<InvoicePDF data={data} />));
}

const currency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "long",
  timeZone: "Asia/Jerusalem",
});

export function buildInvoiceEmail(params: {
  clientFirstName: string;
  businessName: string;
  invoiceNumber: number;
  issueDate: Date;
  total: number;
  balance: number;
}): { subject: string; html: string; text: string } {
  const number = String(params.invoiceNumber).padStart(4, "0");
  const subject = `חשבונית #${number} מ${params.businessName}`;

  const balanceLine =
    params.balance > 0
      ? `יתרה לתשלום: ${currency.format(params.balance)}`
      : "החשבונית שולמה במלואה.";

  const text = [
    `שלום ${params.clientFirstName},`,
    "",
    `מצורפת חשבונית #${number} מתאריך ${dateFmt.format(params.issueDate)}.`,
    `סה״כ: ${currency.format(params.total)}`,
    balanceLine,
    "",
    `בברכה,`,
    params.businessName,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">חשבונית #${number}</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">
        שלום ${params.clientFirstName},
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">
        מצורפת חשבונית #${number} מתאריך ${dateFmt.format(params.issueDate)}.
      </p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#6B5F52;">סה״כ</td>
          <td style="padding:8px 0;font-size:16px;color:#1A1714;font-weight:bold;text-align:left;" dir="ltr">${currency.format(params.total)}</td>
        </tr>
        <tr style="border-top:1px solid #E8E2D5;">
          <td style="padding:8px 0;font-size:14px;color:#6B5F52;" colspan="2">${balanceLine}</td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:14px;color:#6B5F52;">
        בברכה,<br/>${params.businessName}
      </p>
    </div>
    <p style="margin:16px 4px 0;font-size:11px;color:#9A8E80;text-align:center;">
      מסמך זה אינו חשבונית מס.
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
