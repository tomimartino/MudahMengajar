import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatRupiah } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export interface InvoicePdfProps {
  businessName: string;
  address: string | null;
  whatsapp: string | null;
  invoiceNumber: string;
  status: string;
  dueDate: string | null;
  today: string;
  studentName: string;
  parentName: string | null;
  parentWhatsapp: string | null;
  periodLabel: string;
  createdAt: string;
  amount: number;
  paidTotal: number;
  remaining: number;
  paymentRows: Array<{ payment_date: string; method: string; amount: string }>;
  tz: string;
}

const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

function badgeInfo(status: string, dueDate: string | null, today: string) {
  if (status === "paid") return { label: "LUNAS", color: "#065f46", bg: "#d1fae5" };
  if (status === "partial") return { label: "SEBAGIAN", color: "#92400e", bg: "#fef3c7" };
  const overdue = dueDate && today ? dueDate < today : false;
  return overdue
    ? { label: "JATUH TEMPO", color: "#991b1b", bg: "#fee2e2" }
    : { label: "BELUM BAYAR", color: "#92400e", bg: "#fef3c7" };
}

const STATUS_FOOTER: Record<
  string,
  { color: string; bg: string; border: string; text: (sisa: string, dibayar: string) => string }
> = {
  paid: {
    color: "#065f46",
    bg: "#d1fae5",
    border: "#a7f3d0",
    text: (_sisa, dibayar) => `LUNAS — Pembayaran sebesar ${dibayar} telah diterima. Terima kasih!`,
  },
  partial: {
    color: "#92400e",
    bg: "#fef3c7",
    border: "#fde68a",
    text: (sisa) => `SEBAGIAN — Sisa tagihan ${sisa}.`,
  },
  unpaid: {
    color: "#991b1b",
    bg: "#fee2e2",
    border: "#fecaca",
    text: (sisa) => `BELUM BAYAR — Mohon selesaikan pembayaran sebesar ${sisa} sebelum jatuh tempo.`,
  },
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, color: INK },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 20,
  },
  brand: { flex: 1, paddingRight: 24 },
  businessName: { fontSize: 15, fontWeight: "bold" },
  muted: { color: MUTED, marginTop: 3 },
  invoiceSide: { alignItems: "flex-end" },
  tagihanLabel: { fontSize: 11, fontWeight: "bold", letterSpacing: 1.5 },
  invoiceNumber: { marginTop: 3 },
  badge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8.5,
    fontWeight: "bold",
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 5,
  },
  studentName: { fontWeight: "bold" },
  summary: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  summaryRowLast: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: BORDER, fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  historyTitle: { fontWeight: "bold", marginBottom: 6 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  colDate: { flex: 1 },
  colMethod: { flex: 1 },
  colAmount: { flex: 0.7, textAlign: "right" },
  footer: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
  },
});

export function InvoicePdf({
  businessName,
  address,
  whatsapp,
  invoiceNumber,
  status,
  dueDate,
  today,
  studentName,
  parentName,
  parentWhatsapp,
  periodLabel,
  createdAt,
  amount,
  paidTotal,
  remaining,
  paymentRows,
  tz,
}: InvoicePdfProps) {
  const badge = badgeInfo(status, dueDate, today);
  const footer = STATUS_FOOTER[status] ?? STATUS_FOOTER.unpaid;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.businessName}>{businessName}</Text>
            {address && <Text style={styles.muted}>{address}</Text>}
            {whatsapp && <Text style={styles.muted}>WA: {whatsapp}</Text>}
          </View>
          <View style={styles.invoiceSide}>
            <Text style={styles.tagihanLabel}>TAGIHAN</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.bg }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>DITUJUKAN KEPADA</Text>
            <Text style={styles.studentName}>{studentName}</Text>
            <Text style={styles.muted}>Wali: {parentName ?? "—"}</Text>
            <Text style={styles.muted}>WA: {parentWhatsapp ?? "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.sectionTitle}>DETAIL TAGIHAN</Text>
            <Text style={styles.muted}>Periode: {periodLabel}</Text>
            <Text style={styles.muted}>Diterbitkan: {formatDate(createdAt, tz)}</Text>
            <Text style={styles.muted}>Jatuh tempo: {dueDate ? formatDate(dueDate, tz) : "—"}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Total Tagihan</Text>
            <Text style={styles.bold}>{formatRupiah(amount)}</Text>
          </View>
          {paidTotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.muted}>Dibayar</Text>
              <Text>{formatRupiah(paidTotal)}</Text>
            </View>
          )}
          {status !== "paid" && (
            <View style={styles.summaryRowLast}>
              <Text>Sisa Tagihan</Text>
              <Text>{formatRupiah(remaining)}</Text>
            </View>
          )}
        </View>

        {paymentRows.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.historyTitle}>Riwayat Pembayaran</Text>
            <View style={styles.tableHead}>
              <Text style={styles.colDate}>Tanggal</Text>
              <Text style={styles.colMethod}>Metode</Text>
              <Text style={styles.colAmount}>Nominal</Text>
            </View>
            {paymentRows.map((p) => (
              <View key={`${p.payment_date}-${p.amount}`} style={styles.tableRow} wrap={false}>
                <Text style={styles.colDate}>{formatDate(p.payment_date, tz)}</Text>
                <Text style={styles.colMethod}>
                  {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}
                </Text>
                <Text style={styles.colAmount}>{formatRupiah(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        <View
          style={[
            styles.footer,
            { color: footer.color, backgroundColor: footer.bg, borderColor: footer.border },
          ]}
        >
          <Text>{footer.text(formatRupiah(remaining), formatRupiah(paidTotal))}</Text>
        </View>
      </Page>
    </Document>
  );
}
