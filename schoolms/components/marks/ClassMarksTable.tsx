"use client";

import { useState } from "react";
import Link from "next/link";
import { applyWRule, isWMark } from "@/lib/w-rule";

interface StudentDoc {
  id: string;
  name: string;
  indexNumber: string;
  electives?: { categoryI: string; categoryII: string; categoryIII: string };
}

interface MarkRecordDoc {
  studentId: string;
  term: string;
  marks: Record<string, number | null>;
}

interface Props {
  students: StudentDoc[];
  marks: MarkRecordDoc[];
  term: string;
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

function cellClass(value: string): string {
  if (value === "W") return "font-bold text-amber-600";
  if (value === "\u2014") return "text-gray-400";
  return "";
}

/** Clickable W cell that reveals the actual mark on click */
function WMarkCell({
  raw,
  electiveSubject,
}: {
  raw: number | null;
  electiveSubject: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const display = applyWRule(raw);
  const isW = isWMark(raw);

  return (
    <td
      className={`px-3 py-2 text-center ${cellClass(display)} ${
        isW ? "cursor-pointer select-none hover:bg-amber-50 transition-colors" : ""
      }`}
      onClick={isW ? () => setRevealed((v) => !v) : undefined}
      title={isW ? "Click to reveal actual mark" : undefined}
      aria-label={
        display === "W"
          ? "Warning — below passing threshold"
          : display === "\u2014"
            ? "Not entered"
            : undefined
      }
    >
      {electiveSubject && (
        <div className="text-[10px] leading-tight text-muted-foreground">
          {electiveSubject}
        </div>
      )}
      {isW && revealed ? raw : display}
    </td>
  );
}

export default function ClassMarksTable({
  students,
  marks,
  term,
}: Props) {
  const marksMap = new Map<string, Record<string, number | null>>();
  for (const m of marks) {
    if (m.term === term) marksMap.set(m.studentId, m.marks);
  }

  const subjectLabels = SUBJECT_KEYS.map((key) => {
    if (CORE_LABELS[key]) return CORE_LABELS[key];
    if (key === "categoryI") return "Category I";
    if (key === "categoryII") return "Category II";
    if (key === "categoryIII") return "Category III";
    return key;
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th
              className="whitespace-nowrap px-3 py-2 text-left font-medium"
              scope="col"
            >
              Student
            </th>
            {subjectLabels.map((label, i) => (
              <th
                key={SUBJECT_KEYS[i]}
                className="whitespace-nowrap px-3 py-2 text-center font-medium"
                scope="col"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const studentMarks = marksMap.get(student.id);
            return (
              <tr key={student.id} className="border-b">
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="mr-2 text-muted-foreground">
                    {student.indexNumber}
                  </span>
                  <Link
                    href={`/dashboard/students/${student.id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {student.name}
                  </Link>
                </td>
                {SUBJECT_KEYS.map((key) => {
                  const raw = studentMarks ? studentMarks[key] : null;
                  const isElective = key === "categoryI" || key === "categoryII" || key === "categoryIII";
                  const electiveSubject = isElective && student.electives
                    ? student.electives[key as keyof typeof student.electives]
                    : null;
                  return (
                    <WMarkCell
                      key={key}
                      raw={raw ?? null}
                      electiveSubject={electiveSubject}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
