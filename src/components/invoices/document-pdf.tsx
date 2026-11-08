import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  DOC_KINDS,
  PAYMENT_KIND_LABELS,
  documentTotals,
  formatDocMoney,
  lineAgorot,
  type DocumentDraft,
} from "@/lib/billing-docs";
import { DEFAULT_DOC_LOOK, DOC_COLORS, tint } from "@/lib/document-look";
import type { DocBusiness } from "@/lib/document-business";
import { paymentDetailsLine, previewNotice } from "./document-preview";

// The draft PDF of a "מסמך חדש" document: the same layout, template and color
// as DocumentPreview. Hebrew rules (see components/pdf/rtl-text.tsx):
// direction "rtl" on every <Text>, never "\n" inside one; rows run
// "row-reverse" so the first child sits on the right.

const C = {
  ink: "#1A1714",
  soft: "#3A332C",
  muted: "#6B5F52",
  line: "#E8E2D5",
  cream: "#FAF7F1",
  gold: "#F1E3B8",
  white: "#FFFFFF",
};

// Right-to-left marks keep neutral characters (colons, digits) on the right side
const RLM = "‏";
const rtl = (s: string) => `${RLM}${s}${RLM}`;
const R = { direction: "rtl" as const, textAlign: "right" as const };

const s = StyleSheet.create({
  page: { fontFamily: "Heebo", fontSize: 10, color: C.ink, paddingBottom: 56 },
  notice: {
    ...R,
    textAlign: "center",
    fontSize: 8,
    color: C.soft,
    backgroundColor: C.cream,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 120,
    fontWeight: 700,
    color: "#F3F1EC",
    transform: "rotate(-30deg)",
  },
  body: { paddingHorizontal: 42, paddingTop: 18 },
  row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  bizRow: { flexDirection: "row-reverse", alignItems: "flex-start", maxWidth: 300 },
  logo: { width: 52, height: 52, borderRadius: 8, marginLeft: 10, objectFit: "cover" },
  name: { ...R, fontSize: 17, fontWeight: 700 },
  small: { ...R, fontSize: 8.5, color: C.muted, marginTop: 1.5 },
  title: { ...R, fontSize: 20, fontWeight: 700 },
  meta: { ...R, fontSize: 9.5, marginTop: 2 },
  label: { ...R, fontSize: 8, color: C.muted },
  client: { ...R, fontSize: 12, fontWeight: 700, marginTop: 1 },
  th: { ...R, fontSize: 8.5, fontWeight: 500, paddingVertical: 5, paddingHorizontal: 5 },
  td: { ...R, fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 5, color: C.soft },
  tr: { flexDirection: "row-reverse", borderBottomWidth: 0.5, borderBottomColor: C.line },
  colDesc: { flex: 4 },
  colQty: { width: 44, textAlign: "center" },
  colMoney: { width: 82, textAlign: "left" },
  colDetails: { flex: 3 },
  colDate: { width: 70, textAlign: "center" },
  totals: { width: 210, marginTop: 8, alignSelf: "flex-start" },
  totalRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 2.5 },
  totalGrand: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 2,
  },
  h3: { ...R, fontSize: 10.5, fontWeight: 700, marginBottom: 5 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 42,
    right: 42,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerText: { ...R, textAlign: "center", fontSize: 7.5, color: C.muted },
  signature: { alignSelf: "flex-start", alignItems: "center", marginTop: 18, width: 170 },
  signatureImg: { maxHeight: 56, maxWidth: 160, objectFit: "contain" },
});

function heDate(day: string | null | undefined): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export type DocumentPdfData = {
  draft: DocumentDraft;
  /** logo and signature already checked as PNG/JPEG (pdfLogo) */
  business: DocBusiness;
  number: string | null;
  status: "draft" | "issued";
  producedAt: string;
};

export function DocumentPDF({ data }: { data: DocumentPdfData }) {
  const { draft, business, number, status, producedAt } = data;
  const info = DOC_KINDS[draft.kind];
  const t = documentTotals(draft, business.vatLiable);
  const money = (a: number) => formatDocMoney(a, draft.currency);
  const look = business.look ?? DEFAULT_DOC_LOOK;
  const color = DOC_COLORS[look.color].hex;
  const light = tint(color);
  const band = look.template === "band";
  const minimal = look.template === "minimal";
  const showVat = business.vatLiable && draft.vatType !== 1;
  const onBand = band ? C.white : undefined;
  const subtle = band ? "#F2F2F2" : C.muted;

  // One <Text> each, laid out right to left, so the order holds whatever the bidi does
  const contact = [business.phone, business.email, business.website].filter(Boolean) as string[];
  const idLine = business.businessId
    ? `${business.vatLiable ? "עוסק מורשה" : "עוסק פטור"} ${business.businessId}`
    : null;
  const thRow = band
    ? { backgroundColor: color }
    : minimal
      ? { borderBottomWidth: 1.5, borderBottomColor: color }
      : { backgroundColor: light };
  const thText = band ? { color: C.white } : { color: C.ink };
  const grand = band ? { backgroundColor: color } : { backgroundColor: light };
  const grandText = band ? { color: C.white } : { color: C.ink };
  const align = minimal ? ({ textAlign: "center" } as const) : {};

  const businessBlock = (
    <View style={minimal ? { alignItems: "center" } : s.bizRow}>
      {business.logoUrl && (
        // react-pdf's Image (a PDF image object), not an HTML <img>: it takes no alt
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={business.logoUrl} style={minimal ? [s.logo, { marginLeft: 0, marginBottom: 6 }] : s.logo} />
      )}
      <View style={minimal ? { alignItems: "center" } : undefined}>
        <Text style={[s.name, align, { color: onBand ?? color }]}>{rtl(business.name || "שם העסק")}</Text>
        {business.occupation && <Text style={[s.meta, align, onBand ? { color: onBand } : {}]}>{rtl(business.occupation)}</Text>}
        {business.description && (
          <Text style={[s.small, align, { color: subtle }]}>{rtl(business.description.replace(/\s*\n\s*/g, " "))}</Text>
        )}
        {idLine && <Text style={[s.small, align, { color: subtle }]}>{rtl(idLine)}</Text>}
        {business.address && <Text style={[s.small, align, { color: subtle }]}>{rtl(business.address)}</Text>}
        {contact.length > 0 && (
          <View style={{ flexDirection: "row-reverse", justifyContent: minimal ? "center" : "flex-start", flexWrap: "wrap" }}>
            {contact.map((c, i) => (
              <Text key={c} style={[s.small, { color: subtle, textAlign: "left", direction: "ltr" }]}>
                {i > 0 ? `${c}  ·  ` : c}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const docBlock = (
    <View style={minimal ? { alignItems: "center" } : { alignItems: "flex-start" }}>
      <Text style={[s.title, minimal ? align : { textAlign: "left" }, { color: onBand ?? color }]}>{rtl(info.label)}</Text>
      <Text style={[s.meta, minimal ? align : { textAlign: "left" }, onBand ? { color: onBand } : {}]}>
        {number ? rtl(`מס׳ ${number}`) : rtl("טיוטה")}
      </Text>
    </View>
  );

  const dateLines = (
    <View style={minimal ? { alignItems: "center", marginTop: 4 } : { alignItems: "flex-start", marginTop: 4 }}>
      <Text style={[s.meta, minimal ? align : { textAlign: "left" }]}>{rtl(`תאריך: ${heDate(draft.date)}`)}</Text>
      {info.hasDueDate && draft.dueDate && (
        <Text style={[s.meta, minimal ? align : { textAlign: "left" }]}>{rtl(`לתשלום עד: ${heDate(draft.dueDate)}`)}</Text>
      )}
    </View>
  );

  return (
    <Document title={`${info.label} ${number ?? "טיוטה"}`} author={business.name} language="he">
      <Page size="A4" style={s.page}>
        <Text style={s.notice} fixed>
          {rtl(previewNotice(status))}
        </Text>
        {status === "draft" && (
          <Text style={[s.watermark, R, { textAlign: "center" }]} fixed>
            {rtl("טיוטה")}
          </Text>
        )}

        {band ? (
          <View style={{ backgroundColor: color, paddingHorizontal: 42, paddingVertical: 20 }}>
            <View style={s.row}>
              {businessBlock}
              {docBlock}
            </View>
          </View>
        ) : null}

        <View style={s.body}>
          {minimal && (
            <View style={{ alignItems: "center" }}>
              {businessBlock}
              <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, marginTop: 10, paddingTop: 10, width: "100%", alignItems: "center" }}>
                {docBlock}
              </View>
            </View>
          )}
          {!band && !minimal && (
            <View style={[s.row, { borderBottomWidth: 2.5, borderBottomColor: color, paddingBottom: 12 }]}>
              {businessBlock}
              <View>
                {docBlock}
                {dateLines}
              </View>
            </View>
          )}

          <View style={[s.row, { marginTop: 16 }]}>
            <View>
              <Text style={s.label}>לכבוד</Text>
              <Text style={s.client}>{rtl(draft.clientName || "—")}</Text>
              {draft.clientTaxId && <Text style={s.small}>{rtl(`ח.פ / ת.ז: ${draft.clientTaxId}`)}</Text>}
            </View>
            {(band || minimal) && dateLines}
          </View>
          {draft.description && (
            <Text style={[s.meta, { marginTop: 8, color: C.soft }]}>{rtl(draft.description.replace(/\s*\n\s*/g, " "))}</Text>
          )}

          {info.hasItems && (
            <View style={{ marginTop: 16 }}>
              <View style={[s.tr, thRow]}>
                <Text style={[s.th, s.colDesc, thText]}>פירוט</Text>
                <Text style={[s.th, s.colQty, thText]}>כמות</Text>
                <Text style={[s.th, s.colMoney, thText]}>מחיר ליחידה</Text>
                <Text style={[s.th, s.colMoney, thText]}>סה״כ</Text>
              </View>
              {draft.items.map((it, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.colDesc]}>{rtl((it.description || "—").replace(/\s*\n\s*/g, " "))}</Text>
                  <Text style={[s.td, s.colQty]}>{String(it.quantity)}</Text>
                  <Text style={[s.td, s.colMoney]}>{money(it.unitPriceAgorot)}</Text>
                  <Text style={[s.td, s.colMoney]}>{money(lineAgorot(it))}</Text>
                </View>
              ))}
              <View style={s.totals}>
                {showVat && (
                  <>
                    <View style={s.totalRow}>
                      <Text style={[s.meta, { color: C.muted, marginTop: 0 }]}>סכום לפני מע״מ</Text>
                      <Text style={[s.meta, { marginTop: 0 }]}>{money(t.netAgorot)}</Text>
                    </View>
                    <View style={s.totalRow}>
                      <Text style={[s.meta, { color: C.muted, marginTop: 0 }]}>{rtl(`מע״מ ${t.vatPercent}%`)}</Text>
                      <Text style={[s.meta, { marginTop: 0 }]}>{money(t.vatAgorot)}</Text>
                    </View>
                  </>
                )}
                <View style={[s.totalGrand, grand]}>
                  <Text style={[s.meta, { fontWeight: 700, marginTop: 0 }, grandText]}>
                    {info.hasPayments ? "סה״כ" : "סה״כ לתשלום"}
                  </Text>
                  <Text style={[s.meta, { fontWeight: 700, marginTop: 0 }, grandText]}>{money(t.totalAgorot)}</Text>
                </View>
              </View>
            </View>
          )}

          {info.hasPayments && (
            <View style={{ marginTop: 18 }}>
              <Text style={[s.h3, { color }]}>פירוט תקבולים</Text>
              <View style={[s.tr, thRow]}>
                <Text style={[s.th, { width: 90 }, thText]}>סוג התקבול</Text>
                <Text style={[s.th, s.colDetails, thText]}>פרטים</Text>
                <Text style={[s.th, s.colDate, thText]}>תאריך</Text>
                <Text style={[s.th, s.colMoney, thText]}>סכום</Text>
              </View>
              {draft.payments.map((p, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, { width: 90 }]}>{rtl(PAYMENT_KIND_LABELS[p.method])}</Text>
                  <Text style={[s.td, s.colDetails, { fontSize: 8.5 }]}>{rtl(paymentDetailsLine(p) || "—")}</Text>
                  <Text style={[s.td, s.colDate]}>{heDate(p.date)}</Text>
                  <Text style={[s.td, s.colMoney]}>{money(p.amountAgorot)}</Text>
                </View>
              ))}
              <View style={s.totals}>
                <View style={[s.totalGrand, grand]}>
                  <Text style={[s.meta, { fontWeight: 700, marginTop: 0 }, grandText]}>סה״כ שולם</Text>
                  <Text style={[s.meta, { fontWeight: 700, marginTop: 0 }, grandText]}>{money(t.paymentsAgorot)}</Text>
                </View>
              </View>
            </View>
          )}

          {draft.remarks && (
            <View style={{ marginTop: 18 }} wrap={false}>
              <Text style={[s.h3, { color }]}>הערות</Text>
              {draft.remarks
                .replace(/\r\n?/g, "\n")
                .split("\n")
                .map((line, i) => (
                  <Text key={i} style={[s.meta, { color: C.soft, marginTop: 1 }]}>
                    {line.trim() ? rtl(line) : " "}
                  </Text>
                ))}
            </View>
          )}

          {business.signatureUrl && (
            <View style={s.signature} wrap={false}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={business.signatureUrl} style={s.signatureImg} />
              <View style={{ borderTopWidth: 0.5, borderTopColor: C.muted, marginTop: 3, paddingTop: 2, width: 150 }}>
                <Text style={[s.small, { textAlign: "center" }]}>חתימה</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{rtl(`הופק ע״י מרפאה אישית · ${producedAt}`)}</Text>
        </View>
      </Page>
    </Document>
  );
}
