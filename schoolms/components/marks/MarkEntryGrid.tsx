"use client";

import { type RowData } from "@/hooks/useMarkEntryState";
import MarkEntryRow from "./MarkEntryRow";

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

const COLUMN_LABELS: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Maths",
  science: "Science",
  english: "English",
  history: "History",
  categoryI: "Category I",
  categoryII: "Category II",
  categoryIII: "Category III",
};

interface MarkEntryGridProps {
  rows: RowData[];
  editedValues: Map<string, string>;
  dirtyMap: Map<string, number | null>;
  invalidRows: Set<string>;
  onMarkChange: (
    studentId: string,
    subject: string,
    rawValue: string,
    initialMark: number | null
  ) => void;
}

export { SUBJECT_KEYS, COLUMN_LABELS };

export default function MarkEntryGrid({
  rows,
  editedValues,
  dirtyMap,
  invalidRows,
  onMarkChange,
}: MarkEntryGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="rounded-md border min-w-[1200px]">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="lg:sticky lg:left-0 lg:z-10 bg-[hsl(var(--muted))]/50 px-3 py-3 text-left text-xs font-medium w-20">
                #
              </th>
              <th className="md:sticky md:left-0 md:z-10 lg:left-20 bg-[hsl(var(--muted))]/50 px-3 py-3 text-left text-xs font-medium w-48 min-w-48">
                Student Name
              </th>
              {SUBJECT_KEYS.map((key) => (
                <th
                  key={key}
                  className="px-2 py-3 text-center text-xs font-medium w-28"
                >
                  {COLUMN_LABELS[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MarkEntryRow
                key={row.studentId}
                row={row}
                editedValues={editedValues}
                dirtyMap={dirtyMap}
                invalidRows={invalidRows}
                onMarkChange={onMarkChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
