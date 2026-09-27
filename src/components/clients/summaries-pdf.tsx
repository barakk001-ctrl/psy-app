import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { RParagraphs, RText, rtlBase } from "@/components/pdf/rtl-text";

// A client's session summaries as a PDF (clinical record export). Hebrew
// rules for react-pdf are in components/pdf/rtl-text.tsx — every text goes
// through RText / RParagraphs.

const C = {
  ink: "#1A1714",
  soft: "#3A332C",
  muted: "#6B5F52",
  subtle: "#9A8E80",
  border: "#E8E2D5",
  cream: "#FAF7F1",
  sage: "#5C7559",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Heebo",
    fontSize: 10.5,
    color: C.ink,
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 14,
    marginBottom: 18,
  },
  practice: { fontSize: 9, color: C.muted, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: 700, color: C.ink },
  client: { fontSize: 14, fontWeight: 500, color: C.sage, marginTop: 2 },
  meta: { fontSize: 9, color: C.muted, marginTop: 6 },
  entry: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  entryHead: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.cream,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 7,
  },
  entryDate: { fontSize: 10.5, fontWeight: 700, color: C.ink },
  entryTag: { fontSize: 8.5, color: C.muted },
  body: { fontSize: 10.5, color: C.soft, lineHeight: 1.6 },
  empty: { fontSize: 11, color: C.muted, marginTop: 30, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.subtle,
  },
});

export type SummariesPdfData = {
  practiceName: string;
  clientName: string;
  clientIdNumber: string | null;
  generatedAt: string; // pre-formatted
  entries: { date: string; tag: string; text: string }[];
};

export function SummariesPDF({ data }: { data: SummariesPdfData }) {
  return (
    <Document title={`סיכומי פגישות — ${data.clientName}`} author={data.practiceName} language="he">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          {data.practiceName ? <RText style={s.practice}>{data.practiceName}</RText> : null}
          <RText style={s.title}>סיכומי פגישות</RText>
          <RText style={s.client}>{data.clientName}</RText>
          <RText style={s.meta}>
            {[
              data.clientIdNumber ? `ת.ז ${data.clientIdNumber}` : null,
              data.entries.length === 1 ? "סיכום אחד" : `${data.entries.length} סיכומים`,
              `הופק ב-${data.generatedAt}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </RText>
        </View>

        {data.entries.length === 0 ? (
          <Text style={[rtlBase, s.empty]}>עדיין אין סיכומים מתועדים ללקוח/ה זה/ו.</Text>
        ) : (
          data.entries.map((e, i) => (
            <View key={i} style={s.entry}>
              <View style={s.entryHead} wrap={false}>
                <RText style={s.entryDate}>{e.date}</RText>
                {e.tag ? <RText style={s.entryTag}>{e.tag}</RText> : null}
              </View>
              <RParagraphs text={e.text} style={s.body} />
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <RText>{`מסמך חסוי — מידע קליני · ${data.clientName}`}</RText>
          <Text
            style={rtlBase}
            render={({ pageNumber, totalPages }) => `עמוד ${pageNumber} מתוך ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
