import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { RText, rtlBase } from "@/components/pdf/rtl-text";

// Income report PDF (reports page → ייצוא דוח הכנסות). Hebrew rules for
// react-pdf are in components/pdf/rtl-text.tsx — every text goes through RText.

const C = {
  ink: "#1A1714",
  soft: "#3A332C",
  muted: "#6B5F52",
  subtle: "#9A8E80",
  border: "#E8E2D5",
  cream: "#FAF7F1",
  sage: "#5C7559",
  sageLight: "#F1F4ED",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Heebo",
    fontSize: 9.5,
    color: C.ink,
    paddingTop: 42,
    paddingBottom: 54,
    paddingHorizontal: 42,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  practice: { fontSize: 9, color: C.muted, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700 },
  period: { fontSize: 13, fontWeight: 500, color: C.sage, marginTop: 2 },
  meta: { fontSize: 8.5, color: C.muted, marginTop: 5 },
  cards: { flexDirection: "row-reverse", gap: 8, marginBottom: 6 },
  card: {
    flex: 1,
    backgroundColor: C.sageLight,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cardLabel: { fontSize: 8, color: C.muted },
  cardValue: { fontSize: 14, fontWeight: 700, marginTop: 3 },
  note: { fontSize: 8, color: C.muted, marginBottom: 14 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 6 },
  table: { marginBottom: 8 },
  th: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    paddingVertical: 4,
  },
  tr: {
    flexDirection: "row-reverse",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingVertical: 3.5,
  },
  total: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: C.ink,
    paddingVertical: 4,
  },
  thText: { fontSize: 8, fontWeight: 500, color: C.muted },
  td: { fontSize: 9, color: C.soft },
  bold: { fontWeight: 700, color: C.ink },
  empty: { fontSize: 9, color: C.muted, paddingVertical: 6 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.subtle,
  },
});

export type IncomePdfData = {
  practiceName: string;
  periodLabel: string;
  generatedAt: string;
  // All money values pre-formatted
  received: string;
  expected: string;
  held: number;
  cancelled: number;
  receivedFromSessions: string;
  receivedFromInvoices: string;
  hasInvoicePayments: boolean;
  clients: { name: string; held: number; expected: string; received: string }[];
  methods: { label: string; count: number; total: string }[];
  sessions: {
    date: string;
    client: string;
    status: string;
    rate: string;
    paid: string;
    method: string;
  }[];
  invoicePayments: { date: string; client: string; amount: string; method: string }[];
};

// `ltr` keeps "02.09.26 12:00" in reading order — in an RTL line the date
// and time runs would otherwise swap places
type Col = { flex: number; align?: "right" | "left" | "center"; ltr?: boolean };

function Row({
  cells,
  cols,
  style,
  textStyle,
}: {
  cells: (string | number)[];
  cols: Col[];
  style: Style;
  textStyle: Style | Style[];
}) {
  const ts = Array.isArray(textStyle) ? textStyle : [textStyle];
  return (
    <View style={style} wrap={false}>
      {cells.map((c, i) => (
        <Text
          key={i}
          style={[
            rtlBase,
            ...ts,
            { flex: cols[i].flex, textAlign: cols[i].align ?? "right", paddingHorizontal: 3 },
            ...(cols[i].ltr ? [{ direction: "ltr" as const }] : []),
          ]}
        >
          {String(c)}
        </Text>
      ))}
    </View>
  );
}

function Table({
  head,
  rows,
  cols,
  totals,
  emptyText,
}: {
  head: string[];
  rows: (string | number)[][];
  cols: Col[];
  totals?: (string | number)[];
  emptyText: string;
}) {
  return (
    <View style={s.table}>
      <Row cells={head} cols={cols} style={s.th} textStyle={s.thText} />
      {rows.length === 0 ? (
        <RText style={s.empty}>{emptyText}</RText>
      ) : (
        rows.map((r, i) => <Row key={i} cells={r} cols={cols} style={s.tr} textStyle={s.td} />)
      )}
      {totals && rows.length > 0 && (
        <Row cells={totals} cols={cols} style={s.total} textStyle={[s.td, s.bold]} />
      )}
    </View>
  );
}

export function IncomePDF({ data }: { data: IncomePdfData }) {
  const clientCols: Col[] = [{ flex: 4 }, { flex: 1.4, align: "center" }, { flex: 2 }, { flex: 2 }];
  const methodCols: Col[] = [{ flex: 4 }, { flex: 1.4, align: "center" }, { flex: 2 }];
  const sessionCols: Col[] = [
    { flex: 2.6, ltr: true },
    { flex: 3 },
    { flex: 1.8 },
    { flex: 1.6 },
    { flex: 1.6 },
    { flex: 1.8 },
  ];
  const paymentCols: Col[] = [{ flex: 2.2, ltr: true }, { flex: 3 }, { flex: 1.8 }, { flex: 1.8 }];

  return (
    <Document title={`דוח הכנסות — ${data.periodLabel}`} author={data.practiceName} language="he">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          {data.practiceName ? <RText style={s.practice}>{data.practiceName}</RText> : null}
          <RText style={s.title}>דוח הכנסות</RText>
          <RText style={s.period}>{data.periodLabel}</RText>
          <RText style={s.meta}>{`הופק ב-${data.generatedAt}`}</RText>
        </View>

        <View style={s.cards}>
          {[
            ["התקבל", data.received],
            ["הכנסה צפויה לפי היומן", data.expected],
            ["פגישות שהתקיימו", String(data.held)],
            ["בוטלו / לא התקיימו", String(data.cancelled)],
          ].map(([label, value]) => (
            <View key={label} style={s.card}>
              <RText style={s.cardLabel}>{label}</RText>
              <RText style={s.cardValue}>{value}</RText>
            </View>
          ))}
        </View>
        <RText style={s.note}>
          {data.hasInvoicePayments
            ? `התקבל = תשלומים שסומנו בפגישות (${data.receivedFromSessions}) + תשלומים שנרשמו בחשבוניות במערכת (${data.receivedFromInvoices}).`
            : "התקבל = תשלומים שסומנו כ״שולם״ בפגישות. הכנסה צפויה = התעריף של הפגישות שנקבעו או התקיימו."}
        </RText>

        <RText style={s.h2}>פילוח לפי לקוח/ה</RText>
        <Table
          head={["לקוח/ה", "התקיימו", "צפוי", "התקבל"]}
          cols={clientCols}
          rows={data.clients.map((c) => [c.name, c.held, c.expected, c.received])}
          totals={["סה״כ", data.held, data.expected, data.received]}
          emptyText="אין פגישות או תשלומים בתקופה זו."
        />

        {data.methods.length > 0 && (
          <>
            <RText style={s.h2}>לפי אמצעי תשלום</RText>
            <Table
              head={["אמצעי תשלום", "תשלומים", "סכום"]}
              cols={methodCols}
              rows={data.methods.map((m) => [m.label, m.count, m.total])}
              emptyText=""
            />
          </>
        )}

        <RText style={s.h2}>פירוט פגישות</RText>
        <Table
          head={["תאריך", "לקוח/ה", "סטטוס", "תעריף", "שולם", "אמצעי"]}
          cols={sessionCols}
          rows={data.sessions.map((r) => [r.date, r.client, r.status, r.rate, r.paid, r.method])}
          emptyText="אין פגישות בתקופה זו."
        />

        {data.invoicePayments.length > 0 && (
          <>
            <RText style={s.h2}>תשלומים שנרשמו בחשבוניות</RText>
            <Table
              head={["תאריך", "לקוח/ה", "סכום", "אמצעי"]}
              cols={paymentCols}
              rows={data.invoicePayments.map((p) => [p.date, p.client, p.amount, p.method])}
              emptyText=""
            />
          </>
        )}

        <View style={s.footer} fixed>
          <RText>דוח פנימי מתוך המערכת — אינו מסמך חשבונאי. הוצאות אינן נרשמות במערכת.</RText>
          <Text
            style={rtlBase}
            render={({ pageNumber, totalPages }) => `עמוד ${pageNumber} מתוך ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
