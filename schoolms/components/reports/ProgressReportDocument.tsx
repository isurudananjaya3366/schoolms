import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Types ───────────────────────────────────────────────

interface ProgressReportDocumentProps {
  schoolName: string;
  academicYear: number;
  studentName: string;
  indexNumber: string | null;
  grade: number;
  className: string;
  processedMarks: Record<string, Record<string, string>>;
  rawMarks: Record<string, Record<string, number | null>>;
  electiveLabels: { labelI: string; labelII: string; labelIII: string };
  studentElectives: { categoryI: string; categoryII: string; categoryIII: string };
  generatedAt: string;
  schoolLogoUrl?: string | null;
  classTeacherSignUrl?: string | null;
  principalSignUrl?: string | null;
  vicePrincipalSignUrl?: string | null;
  classTeacherField?: boolean;
  principalField?: boolean;
  vicePrincipalField?: boolean;
}

// ─── Subject Configuration ───────────────────────────────

const CORE_SUBJECTS: { key: string; label: string }[] = [
  { key: "sinhala", label: "Sinhala" },
  { key: "buddhism", label: "Buddhism" },
  { key: "maths", label: "Mathematics" },
  { key: "science", label: "Science" },
  { key: "english", label: "English" },
  { key: "history", label: "History" },
];

const TERM_KEYS = ["TERM_1", "TERM_2", "TERM_3"] as const;
const TERM_LABELS = ["Term 1", "Term 2", "Term 3"];

// ─── Styles ──────────────────────────────────────────────

const colors = {
  primary: "#254E58",
  primaryLight: "#3a6d78",
  header: "#0f172a",
  subHeader: "#334155",
  body: "#1e293b",
  muted: "#64748b",
  lightMuted: "#94a3b8",
  bg: "#f8fafc",
  bgAlt: "#f1f5f9",
  border: "#e2e8f0",
  accent: "#0ea5e9",
  warning: "#ea580c",
  warningBg: "#fef9c3",
  warningBorder: "#ea580c",
  warningText: "#78350f",
  warningTitle: "#92400e",
  white: "#ffffff",
  success: "#16a34a",
  danger: "#dc2626",
  chartBar1: "#254E58",
  chartBar2: "#3a6d78",
  chartBar3: "#88BDBC",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 25,
    paddingBottom: 35,
    paddingLeft: 50,
    paddingRight: 35,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.body,
  },

  // ─── Header ───
  headerRow: {
    position: "relative",
    alignItems: "center",
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 8,
    paddingTop: 2,
  },
  logo: {
    position: "absolute",
    left: 0,
    top: 2,
    width: 50,
    height: 50,
    objectFit: "contain",
  },
  headerTextBlock: {
    alignItems: "center",
    width: "100%",
  },
  schoolName: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 1,
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.subHeader,
    marginBottom: 1,
  },
  academicYear: {
    fontSize: 9.5,
    color: colors.muted,
  },
  headerNoLogo: {
    alignItems: "center",
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 8,
  },

  // ─── Student Info ───
  infoBar: {
    flexDirection: "row",
    backgroundColor: colors.bgAlt,
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
    marginTop: 6,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.header,
  },

  // ─── Section Title ───
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
    marginTop: 8,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // ─── Table ───
  table: {
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: colors.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subjectCol: {
    width: "34%",
    paddingLeft: 8,
  },
  termCol: {
    width: "16%",
    textAlign: "center",
  },
  avgCol: {
    width: "14%",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.bg,
  },
  subjectText: {
    fontSize: 9,
    paddingLeft: 8,
  },
  subjectTextBold: {
    fontSize: 9,
    paddingLeft: 8,
    fontFamily: "Helvetica-Bold",
  },
  markText: {
    fontSize: 9,
    textAlign: "center",
  },
  markTextBold: {
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  markW: {
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    color: colors.warning,
  },
  markDash: {
    fontSize: 9,
    textAlign: "center",
    color: colors.lightMuted,
  },
  markHighlight: {
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    color: colors.success,
  },

  // ─── Summary Stats ───
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginTop: 3,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgAlt,
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 6,
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 1,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },

  // ─── Chart Section ───
  chartSection: {
    marginTop: 6,
    marginBottom: 6,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    paddingTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 6,
  },
  chartBarGroup: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBarWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: "100%",
  },
  chartBar: {
    width: 14,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartBarLabel: {
    fontSize: 6,
    color: colors.muted,
    textAlign: "center",
    marginTop: 3,
  },
  chartBarValue: {
    fontSize: 6,
    color: colors.white,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 3,
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  chartLegendText: {
    fontSize: 7,
    color: colors.muted,
  },

  // ─── Signatures ───
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 14,
    paddingTop: 6,
  },
  signatureBlock: {
    alignItems: "center",
    width: "30%",
  },
  signatureImage: {
    width: 90,
    height: 35,
    objectFit: "contain" as const,
    marginBottom: 2,
  },
  signatureEmptySpace: {
    height: 35,
    marginBottom: 2,
  },
  signatureLine: {
    width: "80%",
    borderBottomWidth: 1,
    borderBottomColor: colors.body,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "center",
  },

  // ─── Footer ───
  footer: {
    position: "absolute",
    bottom: 25,
    left: 50,
    right: 35,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: colors.lightMuted,
  },
});

// ─── Helpers ─────────────────────────────────────────────

function getMarkStyle(value: string) {
  if (value === "W") return styles.markW;
  if (value === "\u2014") return styles.markDash;
  const num = parseInt(value, 10);
  if (!isNaN(num) && num >= 75) return styles.markHighlight;
  return styles.markText;
}

function computeAverage(marksByTerm: Record<string, Record<string, string>>, subjectKey: string): string {
  let sum = 0;
  let count = 0;
  for (const termKey of TERM_KEYS) {
    const val = marksByTerm[termKey]?.[subjectKey];
    if (val && val !== "W" && val !== "\u2014") {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        sum += num;
        count++;
      }
    }
  }
  return count > 0 ? (sum / count).toFixed(1) : "\u2014";
}

function computeTermTotal(
  _processedMarks: Record<string, Record<string, string>>,
  rawMarks: Record<string, Record<string, number | null>>,
  termKey: string,
  subjectKeys: string[]
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const key of subjectKeys) {
    const raw = rawMarks[termKey]?.[key];
    if (raw !== null && raw !== undefined) {
      total += raw;
      count++;
    }
  }
  return { total, count };
}

function computeOverallAverage(
  rawMarks: Record<string, Record<string, number | null>>,
  subjectKeys: string[]
): string {
  let totalSum = 0;
  let totalCount = 0;
  for (const termKey of TERM_KEYS) {
    for (const key of subjectKeys) {
      const raw = rawMarks[termKey]?.[key];
      if (raw !== null && raw !== undefined) {
        totalSum += raw;
        totalCount++;
      }
    }
  }
  return totalCount > 0 ? (totalSum / totalCount).toFixed(1) : "\u2014";
}

// ─── Component ───────────────────────────────────────────

export default function ProgressReportDocument({
  schoolName,
  academicYear,
  studentName,
  indexNumber,
  grade,
  className,
  processedMarks,
  rawMarks,
  electiveLabels,
  studentElectives,
  generatedAt,
  schoolLogoUrl,
  classTeacherSignUrl,
  principalSignUrl,
  vicePrincipalSignUrl,
  classTeacherField,
  principalField,
  vicePrincipalField,
}: ProgressReportDocumentProps) {
  const formattedDate = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Build subject rows: core + student-specific electives
  const electiveRows = [
    { key: "categoryI", label: studentElectives.categoryI || electiveLabels.labelI },
    { key: "categoryII", label: studentElectives.categoryII || electiveLabels.labelII },
    { key: "categoryIII", label: studentElectives.categoryIII || electiveLabels.labelIII },
  ];
  
  const allSubjectRows = [...CORE_SUBJECTS, ...electiveRows];
  const allSubjectKeys = allSubjectRows.map((r) => r.key);

  // Compute term totals and averages for summary
  const termStats = TERM_KEYS.map((termKey) => {
    const { total, count } = computeTermTotal(processedMarks, rawMarks, termKey, allSubjectKeys);
    return { termKey, total, count, avg: count > 0 ? total / count : 0 };
  });

  const overallAvg = computeOverallAverage(rawMarks, allSubjectKeys);

  // Best and worst subjects
  const subjectAvgs = allSubjectRows.map((s) => {
    const avg = computeAverage(processedMarks, s.key);
    return { ...s, avg, avgNum: avg === "\u2014" ? -1 : parseFloat(avg) };
  }).filter(s => s.avgNum >= 0);
  
  const bestSubject = subjectAvgs.length > 0 
    ? subjectAvgs.reduce((best, s) => s.avgNum > best.avgNum ? s : best)
    : null;
  const worstSubject = subjectAvgs.length > 0
    ? subjectAvgs.reduce((worst, s) => s.avgNum < worst.avgNum ? s : worst)
    : null;

  // Chart data: per-subject marks per term
  const chartData = allSubjectRows.map((s) => {
    const termMarks = TERM_KEYS.map((tk) => {
      const raw = rawMarks[tk]?.[s.key];
      return raw !== null && raw !== undefined ? raw : null;
    });
    return { key: s.key, label: s.label, termMarks };
  });

  const hasSignatures = !!classTeacherField || !!principalField || !!vicePrincipalField;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ─── Header with Logo ─── */}
        {schoolLogoUrl ? (
          <View style={styles.headerRow}>
            <Image src={schoolLogoUrl} style={styles.logo} />
            <View style={styles.headerTextBlock}>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.reportTitle}>Student Progress Report</Text>
              <Text style={styles.academicYear}>Academic Year {academicYear}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerNoLogo}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.reportTitle}>Student Progress Report</Text>
            <Text style={styles.academicYear}>Academic Year {academicYear}</Text>
          </View>
        )}


        {/* ─── Student Info Bar ─── */}
        <View style={styles.infoBar}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Student Name</Text>
            <Text style={styles.infoValue}>{studentName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Index Number</Text>
            <Text style={styles.infoValue}>{indexNumber ?? "N/A"}</Text>
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

        {/* ─── Summary Statistics ─── */}
        <View style={styles.statsRow}>
          {termStats.map((ts, i) => (
            <View key={ts.termKey} style={styles.statBox}>
              <Text style={styles.statLabel}>{TERM_LABELS[i]} Avg</Text>
              <Text style={styles.statValue}>
                {ts.count > 0 ? ts.avg.toFixed(1) : "\u2014"}
              </Text>
            </View>
          ))}
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Overall Avg</Text>
            <Text style={styles.statValue}>{overallAvg}</Text>
          </View>
        </View>

        {/* ─── Marks Table ─── */}
        <Text style={styles.sectionTitle}>Subject Marks</Text>
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
            <View style={styles.avgCol}>
              <Text style={styles.tableHeaderText}>Average</Text>
            </View>
          </View>

          {/* Core Subjects */}
          {CORE_SUBJECTS.map((row, idx) => {
            const avg = computeAverage(processedMarks, row.key);
            return (
              <View
                key={row.key}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.subjectCol}>
                  <Text style={styles.subjectText}>{row.label}</Text>
                </View>
                {TERM_KEYS.map((termKey) => {
                  const value = processedMarks[termKey]?.[row.key] ?? "\u2014";
                  return (
                    <View key={termKey} style={styles.termCol}>
                      <Text style={getMarkStyle(value)}>{value}</Text>
                    </View>
                  );
                })}
                <View style={styles.avgCol}>
                  <Text style={styles.markTextBold}>{avg}</Text>
                </View>
              </View>
            );
          })}

          {/* Elective Separator */}
          <View style={[styles.tableRow, { backgroundColor: colors.bgAlt }]}>
            <View style={styles.subjectCol}>
              <Text style={[styles.subjectTextBold, { color: colors.primary, fontSize: 8 }]}>
                Elective Subjects
              </Text>
            </View>
            {TERM_LABELS.map((l) => (
              <View key={l} style={styles.termCol}><Text> </Text></View>
            ))}
            <View style={styles.avgCol}><Text> </Text></View>
          </View>

          {/* Elective Subjects (student-specific) */}
          {electiveRows.map((row, idx) => {
            const avg = computeAverage(processedMarks, row.key);
            return (
              <View
                key={row.key}
                style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.subjectCol}>
                  <Text style={styles.subjectText}>{row.label}</Text>
                </View>
                {TERM_KEYS.map((termKey) => {
                  const value = processedMarks[termKey]?.[row.key] ?? "\u2014";
                  return (
                    <View key={termKey} style={styles.termCol}>
                      <Text style={getMarkStyle(value)}>{value}</Text>
                    </View>
                  );
                })}
                <View style={styles.avgCol}>
                  <Text style={styles.markTextBold}>{avg}</Text>
                </View>
              </View>
            );
          })}

          {/* Total Row */}
          <View style={[styles.tableRow, { backgroundColor: colors.primary }]}>
            <View style={styles.subjectCol}>
              <Text style={[styles.subjectTextBold, { color: colors.white }]}>Total</Text>
            </View>
            {TERM_KEYS.map((termKey) => {
              const { total, count } = computeTermTotal(processedMarks, rawMarks, termKey, allSubjectKeys);
              return (
                <View key={termKey} style={styles.termCol}>
                  <Text style={[styles.markTextBold, { color: colors.white }]}>
                    {count > 0 ? String(total) : "\u2014"}
                  </Text>
                </View>
              );
            })}
            <View style={styles.avgCol}>
              <Text style={[styles.markTextBold, { color: colors.white }]}>{overallAvg}</Text>
            </View>
          </View>
        </View>

        {/* ─── Performance Highlights ─── */}
        {(bestSubject || worstSubject) && (
          <View style={styles.statsRow}>
            {bestSubject && (
              <View style={[styles.statBox, { borderLeftWidth: 3, borderLeftColor: colors.success }]}>
                <Text style={styles.statLabel}>Best Subject</Text>
                <Text style={[styles.statValue, { fontSize: 10, color: colors.success }]}>
                  {bestSubject.label}
                </Text>
                <Text style={[styles.statLabel, { marginTop: 2 }]}>Avg: {bestSubject.avg}</Text>
              </View>
            )}
            {worstSubject && (
              <View style={[styles.statBox, { borderLeftWidth: 3, borderLeftColor: colors.danger }]}>
                <Text style={styles.statLabel}>Needs Improvement</Text>
                <Text style={[styles.statValue, { fontSize: 10, color: colors.danger }]}>
                  {worstSubject.label}
                </Text>
                <Text style={[styles.statLabel, { marginTop: 2 }]}>Avg: {worstSubject.avg}</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Term Performance Chart ─── */}
        <Text style={styles.sectionTitle}>Term-wise Performance</Text>
        <View style={styles.chartSection}>
          <View style={styles.chartRow}>
            {chartData.map((subject) => (
              <View key={subject.key} style={styles.chartBarGroup}>
                <View style={styles.chartBarWrapper}>
                  {subject.termMarks.map((mark, tIdx) => {
                    const height = mark !== null ? Math.max((mark / 100) * 90, 4) : 4;
                    const barColors = [colors.chartBar1, colors.chartBar2, colors.chartBar3];
                    return (
                      <View
                        key={tIdx}
                        style={[
                          styles.chartBar,
                          {
                            height,
                            backgroundColor: mark !== null ? barColors[tIdx] : colors.border,
                          },
                        ]}
                      >
                        {mark !== null && height > 12 && (
                          <Text style={[styles.chartBarValue, { marginTop: 2 }]}>{mark}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.chartBarLabel}>
                  {subject.label.length > 6 ? subject.label.substring(0, 5) + "." : subject.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.chartLegend}>
            {TERM_LABELS.map((label, idx) => {
              const barColors = [colors.chartBar1, colors.chartBar2, colors.chartBar3];
              return (
                <View key={label} style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: barColors[idx] }]} />
                  <Text style={styles.chartLegendText}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── Digital Signatures ─── */}
        {hasSignatures && (
          <View style={styles.signatureSection}>
            {classTeacherField && (
              <View style={styles.signatureBlock}>
                {classTeacherSignUrl ? (
                  <Image src={classTeacherSignUrl} style={styles.signatureImage} />
                ) : (
                  <View style={styles.signatureEmptySpace} />
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Class Teacher</Text>
              </View>
            )}
            {principalField && (
              <View style={styles.signatureBlock}>
                {principalSignUrl ? (
                  <Image src={principalSignUrl} style={styles.signatureImage} />
                ) : (
                  <View style={styles.signatureEmptySpace} />
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Principal</Text>
              </View>
            )}
            {vicePrincipalField && (
              <View style={styles.signatureBlock}>
                {vicePrincipalSignUrl ? (
                  <Image src={vicePrincipalSignUrl} style={styles.signatureImage} />
                ) : (
                  <View style={styles.signatureEmptySpace} />
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Vice Principal</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Footer ─── */}
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
