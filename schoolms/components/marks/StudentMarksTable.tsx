"use client";

import { applyWRule } from "@/lib/w-rule";

interface StudentDoc {
  id: string;
  name: string;
  indexNumber: string;
}

interface MarkRecordDoc {
  term: string;
  marks: Record<string, number | null>;
}

interface Props {
  student: StudentDoc;
  marks: MarkRecordDoc[];
  electiveLabels: { labelI: string; labelII: string; labelIII: string };
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

const TERMS = [
  { key: "TERM_1", label: "Term 1" },
  { key: "TERM_2", label: "Term 2" },
  { key: "TERM_3", label: "Term 3" },
];

function cellClass(value: string): string {
  if (value === "W") return "font-bold text-amber-600";
  if (value === "\u2014") return "text-gray-400";
  return "";
}

export default function StudentMarksTable({
  student,
  marks,
  electiveLabels,
}: Props) {
  // Build term→marks mapping
  const termMap = new Map<string, Record<string, number | null>>();
  for (const m of marks) {
    termMap.set(m.term, m.marks);
  }

  const getSubjectLabel = (key: string): string => {
    if (CORE_LABELS[key]) return CORE_LABELS[key];
    if (key === "categoryI") return electiveLabels.labelI;
    if (key === "categoryII") return electiveLabels.labelII;
    if (key === "categoryIII") return electiveLabels.labelIII;
    return key;
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium" scope="col">
              Subject
            </th>
            {TERMS.map((t) => (
              <th
                key={t.key}
                className="px-4 py-2 text-center font-medium"
                scope="col"
              >
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUBJECT_KEYS.map((key) => (
            <tr key={key} className="border-b">
              <th className="px-4 py-2 text-left font-normal" scope="row">
                {getSubjectLabel(key)}
              </th>
              {TERMS.map((t) => {
                const termMarks = termMap.get(t.key);
                const raw = termMarks ? termMarks[key] : null;
                const display = applyWRule(raw);
                return (
                  <td
                    key={t.key}
                    className={`px-4 py-2 text-center ${cellClass(display)}`}
                    aria-label={
                      display === "W"
                        ? "Warning - below passing threshold"
                        : display === "\u2014"
                          ? "Not entered"
                          : undefined
                    }
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-sm text-muted-foreground">
        {student.name} ({student.indexNumber})
      </div>
    </div>
  );
}
