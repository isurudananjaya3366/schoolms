"use client";

import { useState } from "react";
import { Term } from "@prisma/client";
import { applyWRule, isWMark } from "@/lib/w-rule";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Marks {
  sinhala: number | null;
  buddhism: number | null;
  maths: number | null;
  science: number | null;
  english: number | null;
  history: number | null;
  categoryI: number | null;
  categoryII: number | null;
  categoryIII: number | null;
}

interface MarkRecord {
  id: string;
  term: Term;
  year: number;
  marks: Marks;
}

interface Electives {
  categoryI: string;
  categoryII: string;
  categoryIII: string;
}

interface MarksTableProps {
  markRecords: MarkRecord[];
  electives: Electives;
}

const TERM_LABELS: Record<Term, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

const TERM_ORDER: Term[] = [Term.TERM_1, Term.TERM_2, Term.TERM_3];

const CORE_COLUMNS: { key: keyof Marks; label: string }[] = [
  { key: "sinhala", label: "Sinhala" },
  { key: "buddhism", label: "Buddhism" },
  { key: "maths", label: "Maths" },
  { key: "science", label: "Science" },
  { key: "english", label: "English" },
  { key: "history", label: "History" },
];

function MarkCell({ mark }: { mark: number | null | undefined }) {
  const [revealed, setRevealed] = useState(false);
  const isW = isWMark(mark);
  const display = applyWRule(mark);

  if (isW) {
    return (
      <TableCell
        className="text-red-600 font-semibold cursor-pointer select-none transition-colors hover:bg-red-50"
        onClick={() => setRevealed((v) => !v)}
        title="Click to reveal actual mark"
      >
        {revealed ? mark : display}
      </TableCell>
    );
  }

  return <TableCell>{display}</TableCell>;
}

export default function MarksTable({
  markRecords,
  electives,
}: MarksTableProps) {
  if (markRecords.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No marks recorded yet.
      </p>
    );
  }

  const electiveColumns: { key: keyof Marks; label: string }[] = [
    { key: "categoryI", label: electives.categoryI },
    { key: "categoryII", label: electives.categoryII },
    { key: "categoryIII", label: electives.categoryIII },
  ];

  const allColumns = [...CORE_COLUMNS, ...electiveColumns];

  // Index records by term for O(1) lookup
  const recordByTerm = new Map<Term, MarkRecord>();
  for (const rec of markRecords) {
    recordByTerm.set(rec.term, rec);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Term</TableHead>
          {allColumns.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {TERM_ORDER.map((term) => {
          const record = recordByTerm.get(term);
          return (
            <TableRow key={term}>
              <TableCell className="font-medium">
                {TERM_LABELS[term]}
              </TableCell>
              {allColumns.map((col) => (
                <MarkCell
                  key={col.key}
                  mark={record ? record.marks[col.key] : null}
                />
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
