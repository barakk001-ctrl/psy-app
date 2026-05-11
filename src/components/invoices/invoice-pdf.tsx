import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register Heebo from local files in /public/fonts.
//
// We read the TTF files into Buffers at module load time and pass them directly
// to Font.register. This is more reliable than passing a path string, because:
//   1. Next.js standalone builds change the working directory, breaking
//      `process.cwd()`-based paths
//   2. Any path resolution issue at render time produces an empty PDF (not an
//      error you can see), since the response stream has already started
//
// `__dirname` is unreliable in bundled Next.js code, so we resolve relative to
// process.cwd() but verify the files exist and fall through to a clear error.
function loadFont(filename: string): Buffer {
  // Try a few likely locations. First match wins.
  const candidates = [
    path.join(process.cwd(), "public", "fonts", filename),
    path.join(process.cwd(), ".next", "standalone", "public", "fonts", filename),
    path.join(process.cwd(), "..", "public", "fonts", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  throw new Error(
    `Font file not found: ${filename}. Searched: ${candidates.join(", ")}`,
  );
}

const heebo400 = loadFont("heebo-400.ttf");
const heebo500 = loadFont("heebo-500.ttf");
const heebo700 = loadFont("heebo-700.ttf");

Font.register({
  family: "Heebo",
  fonts: [
    { src: heebo400, fontWeight: 400 },
    { src: heebo500, fontWeight: 500 },
    { src: heebo700, fontWeight: 700 },
  ],
});

// Disable hyphenation — important for Hebrew which doesn't use it
Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  ink: "#1A1714",
  inkSoft: "#3A332C",
  inkMuted: "#6B5F52",
  inkSubtle: "#9A8E80",
  border: "#E8E2D5",
  cream: "#FAF7F1",
  sage: "#5C7559",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Heebo",
    fontSize: 10,
    color: COLORS.ink,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
  },
  // Force whole document RTL
  rtl: {
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandBlock: {
    flexDirection: "column",
    alignItems: "flex-start",
    maxWidth: 260,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.ink,
    marginBottom: 4,
  },
  businessLine: {
    fontSize: 9,
    color: COLORS.inkMuted,
    marginBottom: 1,
  },
  invoiceMeta: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 22,
    fontWeight: 500,
    color: COLORS.sage,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row-reverse",
    gap: 4,
    marginBottom: 1,
  },
  metaLabel: {
    color: COLORS.inkMuted,
    fontSize: 9,
  },
  metaValue: {
    color: COLORS.ink,
    fontSize: 9,
    fontWeight: 500,
  },
  billedToSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 8,
    color: COLORS.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  clientName: {
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 2,
  },
  clientLine: {
    fontSize: 9,
    color: COLORS.inkMuted,
    marginBottom: 1,
  },
  table: {
    marginTop: 8,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  th: {
    fontSize: 8,
    fontWeight: 500,
    color: COLORS.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  td: {
    fontSize: 10,
    color: COLORS.inkSoft,
  },
  colDescription: { flex: 4, paddingHorizontal: 4 },
  colQty: { flex: 1, paddingHorizontal: 4, textAlign: "center" },
  colUnit: { flex: 1.4, paddingHorizontal: 4, textAlign: "left" },
  colAmount: { flex: 1.4, paddingHorizontal: 4, textAlign: "left" },
  totalsBlock: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    marginTop: 8,
  },
  totalsTable: {
    width: "45%",
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalGrand: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.ink,
  },
  totalLabel: {
    fontSize: 10,
    color: COLORS.inkMuted,
  },
  totalValue: {
    fontSize: 10,
    color: COLORS.ink,
    fontWeight: 500,
  },
  totalGrandLabel: {
    fontSize: 12,
    color: COLORS.ink,
    fontWeight: 700,
  },
  totalGrandValue: {
    fontSize: 14,
    color: COLORS.ink,
    fontWeight: 700,
  },
  paymentsSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: COLORS.cream,
    borderRadius: 4,
  },
  paymentRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    fontSize: 9,
    color: COLORS.inkSoft,
    marginBottom: 2,
  },
  notesSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  notesText: {
    fontSize: 9,
    color: COLORS.inkSoft,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 7,
    color: COLORS.inkSubtle,
  },
});

const METHOD_LABELS: Record<string, string> = {
  CASH: "מזומן",
  BIT: "ביט",
  CHECK: "המחאה",
  BANK_TRANSFER: "העברה בנקאית",
  CREDIT_CARD: "כרטיס אשראי",
  PAYPAL: "PayPal",
  OTHER: "אחר",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלחה",
  PARTIALLY_PAID: "שולמה חלקית",
  PAID: "שולמה",
  CANCELLED: "מבוטלת",
};

function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export type InvoicePDFData = {
  number: number;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  subtotal: number;
  total: number;
  amountPaid: number;
  notes: string | null;
  business: {
    name: string;
    businessId: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  client: {
    firstName: string;
    lastName: string;
    idNumber: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  payments: {
    amount: number;
    method: string;
    paidAt: Date;
    reference: string | null;
  }[];
};

export function InvoicePDF({ data }: { data: InvoicePDFData }) {
  const balance = data.total - data.amountPaid;

  return (
    <Document
      title={`חשבונית ${data.number}`}
      author={data.business.name}
      language="he"
    >
      <Page size="A4" style={[styles.page, styles.rtl]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.businessName}>{data.business.name}</Text>
            {data.business.businessId && (
              <Text style={styles.businessLine}>
                ע.מ / ע.פ: {data.business.businessId}
              </Text>
            )}
            {data.business.address && (
              <Text style={styles.businessLine}>{data.business.address}</Text>
            )}
            {data.business.phone && (
              <Text style={styles.businessLine}>טל׳: {data.business.phone}</Text>
            )}
            {data.business.email && (
              <Text style={styles.businessLine}>{data.business.email}</Text>
            )}
          </View>

          <View style={styles.invoiceMeta}>
            <Text style={styles.docTitle}>חשבונית</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>מס׳:</Text>
              <Text style={styles.metaValue}>
                {String(data.number).padStart(4, "0")}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>תאריך:</Text>
              <Text style={styles.metaValue}>{formatDate(data.issueDate)}</Text>
            </View>
            {data.dueDate && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>לתשלום עד:</Text>
                <Text style={styles.metaValue}>{formatDate(data.dueDate)}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>סטטוס:</Text>
              <Text style={styles.metaValue}>
                {STATUS_LABELS[data.status] ?? data.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Billed to */}
        <View style={styles.billedToSection}>
          <Text style={styles.sectionLabel}>לכבוד</Text>
          <Text style={styles.clientName}>
            {data.client.firstName} {data.client.lastName}
          </Text>
          {data.client.idNumber && (
            <Text style={styles.clientLine}>ת.ז: {data.client.idNumber}</Text>
          )}
          {data.client.address && (
            <Text style={styles.clientLine}>{data.client.address}</Text>
          )}
          {data.client.phone && (
            <Text style={styles.clientLine}>טל׳: {data.client.phone}</Text>
          )}
          {data.client.email && (
            <Text style={styles.clientLine}>{data.client.email}</Text>
          )}
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDescription]}>תיאור</Text>
            <Text style={[styles.th, styles.colQty]}>כמות</Text>
            <Text style={[styles.th, styles.colUnit]}>מחיר יחידה</Text>
            <Text style={[styles.th, styles.colAmount]}>סה״כ</Text>
          </View>
          {data.items.map((it, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.td, styles.colDescription]}>{it.description}</Text>
              <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
              <Text style={[styles.td, styles.colUnit]}>{formatILS(it.unitPrice)}</Text>
              <Text style={[styles.td, styles.colAmount]}>{formatILS(it.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>סכום ביניים</Text>
              <Text style={styles.totalValue}>{formatILS(data.subtotal)}</Text>
            </View>
            <View style={styles.totalGrand}>
              <Text style={styles.totalGrandLabel}>סה״כ לתשלום</Text>
              <Text style={styles.totalGrandValue}>{formatILS(data.total)}</Text>
            </View>
            {data.amountPaid > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>שולם</Text>
                  <Text style={styles.totalValue}>−{formatILS(data.amountPaid)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { fontWeight: 700 }]}>יתרה</Text>
                  <Text style={[styles.totalValue, { fontWeight: 700 }]}>
                    {formatILS(balance)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Payments received */}
        {data.payments.length > 0 && (
          <View style={styles.paymentsSection}>
            <Text style={styles.sectionLabel}>תשלומים שהתקבלו</Text>
            {data.payments.map((p, idx) => (
              <View key={idx} style={styles.paymentRow}>
                <Text>
                  {formatDate(p.paidAt)} · {METHOD_LABELS[p.method] ?? p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </Text>
                <Text>{formatILS(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>הערות</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          מסמך זה אינו חשבונית מס. לבירורים: {data.business.phone ?? data.business.email ?? ""}
        </Text>
      </Page>
    </Document>
  );
}
