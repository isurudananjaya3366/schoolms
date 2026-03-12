import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

interface ProgressReportDocumentProps {
  schoolName: string;
  academicYear: number;
  studentName: string;
  indexNumber: string | null;
  grade: number;
  className: string;
  processedMarks: Record<string, Record<string, string>>;
  wNoteData: { subject: string; terms: string[] }[];
  electiveLabels: { labelI: string; labelII: string; labelIII: string };
  generatedAt: string;
}

const SUBJECT_ROWS: { key: string; labelKey?: string }[] = [
  { key: "sinhala" },
  { key: "buddhism" },
  { key: "maths" },
  { key: "science" },
  { key: "english" },
  { key: "history" },
  { key: "categoryI", labelKey: "labelI" },
  { key: "categoryII", labelKey: "labelII" },
  { key: "categoryIII", labelKey: "labelIII" },
];

const CORE_DISPLAY_NAMES: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Maths",
  science: "Science",
  english: "English",
  history: "History",
};

const TERM_KEYS = ["TERM_1", "TERM_2", "TERM_3"] as const;
const TERM_LABELS = ["Term 1", "Term 2", "Term 3"];

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 50,
    paddingRight: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
  },
  // Header
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  schoolName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginBottom: 2,
  },
  academicYear: {
    fontSize: 11,
    color: "#64748b",
  },
  // Student info bar
  infoBar: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  // Table
  table: {
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  subjectCol: {
    width: "40%",
    paddingLeft: 8,
  },
  termCol: {
    width: "20%",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  subjectText: {
    fontSize: 10,
    paddingLeft: 8,
  },
  markText: {
    fontSize: 10,
    textAlign: "center",
  },
  markW: {
    fontSize: 10,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    color: "#ea580c",
  },
  markDash: {
    fontSize: 10,
    textAlign: "center",
    color: "#9ca3af",
  },
  // W-Note section
  wNoteBox: {
    backgroundColor: "#fef9c3",
    borderLeftWidth: 3,
    borderLeftColor: "#ea580c",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  wNoteTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    marginBottom: 6,
  },
  wNoteText: {
    fontSize: 9,
    color: "#78350f",
    marginBottom: 2,
    paddingLeft: 8,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

function getMarkStyle(value: string) {
  if (value === "W") return styles.markW;
  if (value === "\u2014") return styles.markDash;
  return styles.markText;
}

export default function ProgressReportDocument({
  schoolName,
  academicYear,
  studentName,
  indexNumber,
  grade,
  className,
  processedMarks,
  wNoteData,
  electiveLabels,
  generatedAt,
}: ProgressReportDocumentProps) {
  const electiveLabelMap: Record<string, string> = {
    labelI: electiveLabels.labelI,
    labelII: electiveLabels.labelII,
    labelIII: electiveLabels.labelIII,
  };

  const formattedDate = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.reportTitle}>Progress Report</Text>
          <Text style={styles.academicYear}>
            Academic Year {academicYear}
          </Text>
        </View>

        {/* Student Info Bar */}
        <View style={styles.infoBar}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Index No.</Text>
            <Text style={styles.infoValue}>{indexNumber ?? "N/A"}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{studentName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Grade</Text>
            <Text style={styles.infoValue}>{grade}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Class</Text>
            <Text style={styles.infoValue}>{className}</Text>
          </View>
        </View>

        {/* Marks Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <View style={styles.subjectCol}>
              <Text style={styles.tableHeaderText}>Subject</Text>
            </View>
            {TERM_LABELS.map((label) => (
              <View key={label} style={styles.termCol}>
                <Text style={styles.tableHeaderText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Table Rows */}
          {SUBJECT_ROWS.map((row, idx) => {
            const displayName = row.labelKey
              ? electiveLabelMap[row.labelKey] || CORE_DISPLAY_NAMES[row.key] || row.key
              : CORE_DISPLAY_NAMES[row.key] || row.key;

            return (
              <View
                key={row.key}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <View style={styles.subjectCol}>
                  <Text style={styles.subjectText}>{displayName}</Text>
                </View>
                {TERM_KEYS.map((termKey) => {
                  const value =
                    processedMarks[termKey]?.[row.key] ?? "\u2014";
                  return (
                    <View key={termKey} style={styles.termCol}>
                      <Text style={getMarkStyle(value)}>{value}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* W-Note Section */}
        {wNoteData.length > 0 && (
          <View style={styles.wNoteBox}>
            <Text style={styles.wNoteTitle}>
              W-Rule Notice
            </Text>
            <Text style={[styles.wNoteText, { paddingLeft: 0, marginBottom: 4 }]}>
              The following subjects have marks below the threshold (W):
            </Text>
            {wNoteData.map((entry) => (
              <Text key={entry.subject} style={styles.wNoteText}>
                {"\u2022"} {entry.subject} — {entry.terms.join(", ")}
              </Text>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by SchoolMS on {formattedDate}
          </Text>
          <Text style={styles.footerText}>
            Confidential — For school use only
          </Text>
        </View>
      </Page>
    </Document>
  );
}
