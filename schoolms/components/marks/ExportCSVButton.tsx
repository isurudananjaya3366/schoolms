"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { applyWRule } from "@/lib/w-rule";

interface StudentDoc {
  id: string;
  name: string;
  indexNumber: string;
}

interface MarkRecordDoc {
  studentId: string;
  term: string;
  marks: Record<string, number | null>;
}

interface Props {
  students: StudentDoc[];
  marks: MarkRecordDoc[];
  electiveLabels: { labelI: string; labelII: string; labelIII: string };
  className: string;
  term: string;
  year: string;
  disabled?: boolean;
}

const SUBJECT_KEYS = [
  "sinhala",
  "buddhism",
  "maths",
  "science",
  "english",
  "history",
  "categoryI",
  "categoryII",
  "categoryIII",
] as const;

const CORE_LABELS: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Maths",
  science: "Science",
  english: "English",
  history: "History",
};

function termDisplay(term: string): string {
  if (term === "TERM_1") return "I";
  if (term === "TERM_2") return "II";
  if (term === "TERM_3") return "III";
  return term;
}

export default function ExportCSVButton({
  students,
  marks,
  electiveLabels,
  className: classLabel,
  term,
  year,
  disabled,
}: Props) {
  const handleExport = () => {
    const marksMap = new Map<string, Record<string, number | null>>();
    for (const m of marks) {
      if (m.term === term) marksMap.set(m.studentId, m.marks);
    }

    const subjectLabels = SUBJECT_KEYS.map((key) => {
      if (CORE_LABELS[key]) return CORE_LABELS[key];
      if (key === "categoryI") return electiveLabels.labelI;
      if (key === "categoryII") return electiveLabels.labelII;
      if (key === "categoryIII") return electiveLabels.labelIII;
      return key;
    });

    const header = ["Index Number", "Student Name", ...subjectLabels];
    const rows = students.map((s) => {
      const studentMarks = marksMap.get(s.id);
      const markValues = SUBJECT_KEYS.map((key) => {
        const raw = studentMarks ? studentMarks[key] : null;
        const display = applyWRule(raw);
        if (display === "\u2014") return "";
        return display;
      });
      return [s.indexNumber, s.name, ...markValues];
    });

    const csvContent = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (
              str.includes(",") ||
              str.includes('"') ||
              str.includes("\n")
            ) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marks-${classLabel}-term-${termDisplay(term)}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={disabled}
      aria-label={`Export marks for class ${classLabel}, Term ${termDisplay(term)}, ${year} as CSV`}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
