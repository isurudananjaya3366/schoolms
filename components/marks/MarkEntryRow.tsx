"use client";

import { memo } from "react";
import { type RowData } from "@/hooks/useMarkEntryState";
import { Input } from "@/components/ui/input";

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

const CATEGORY_ELECTIVE_MAP: Record<string, keyof RowData["electives"]> = {
  categoryI: "categoryI",
  categoryII: "categoryII",
  categoryIII: "categoryIII",
};

interface MarkEntryRowProps {
  row: RowData;
  editedValues: Map<string, string>;
  dirtyMap: Map<string, number | null>;
  invalidRows: Set<string>;
  onMarkChange: (
    studentId: string,
    subject: string,
    rawValue: string,
    initialMark: number | null
  ) => void;
  /** If provided, only render cells for these subject keys. */
  visibleColumns?: readonly string[];
  /**
   * For elective columns: subject key → Set of studentIds that should show an input.
   * If a student's ID is not in the set for that column, an empty cell is rendered.
   */
  electiveVisibleStudentIds?: ReadonlyMap<string, ReadonlySet<string>>;
}

function MarkEntryRowInner({
  row,
  editedValues,
  dirtyMap,
  invalidRows,
  onMarkChange,
  visibleColumns,
  electiveVisibleStudentIds,
}: MarkEntryRowProps) {
  const activeKeys = visibleColumns
    ? SUBJECT_KEYS.filter((k) => visibleColumns.includes(k))
    : SUBJECT_KEYS;

  // Check if ANY visible subject for this student is dirty
  const isRowDirty = activeKeys.some((s) =>
    dirtyMap.has(`${row.studentId}:${s}`)
  );

  return (
    <tr
      className={`border-b transition-colors ${isRowDirty ? "bg-amber-50/50" : ""}`}
    >
      {/* Index Number */}
      <td className="lg:sticky lg:left-0 lg:z-10 bg-white px-3 py-2 text-xs text-muted-foreground">
        {row.indexNumber ?? "-"}
      </td>

      {/* Student Name */}
      <td className="md:sticky md:left-0 md:z-10 lg:left-20 bg-white px-3 py-2 text-sm font-medium truncate max-w-48">
        {row.studentName}
      </td>

      {/* Subject mark cells */}
      {activeKeys.map((subject) => {
        // If this elective column has a student visibility restriction and this
        // student is not in the allowed set → render an empty blank cell.
        const electiveSet = electiveVisibleStudentIds?.get(subject);
        if (electiveSet !== undefined && !electiveSet.has(row.studentId)) {
          return <td key={subject} className="px-1 py-1.5" />;
        }

        const key = `${row.studentId}:${subject}`;
        const initialMark = row.initialMarks[subject] ?? null;
        const edited = editedValues.get(key);
        const isInvalid = invalidRows.has(key);
        const isDirty = dirtyMap.has(key);

        const displayValue =
          edited !== undefined
            ? edited
            : initialMark !== null
              ? String(initialMark)
              : "";

        const numValue = displayValue === "" ? null : Number(displayValue);
        const showLow =
          !isInvalid && numValue !== null && numValue < 35;

        // Get student's elective name for category subjects
        const electiveField = CATEGORY_ELECTIVE_MAP[subject];
        const electiveName = electiveField
          ? row.electives[electiveField]
          : null;

        return (
          <td key={subject} className="px-1 py-1.5 text-center">
            <div className="flex flex-col items-center">
              {/* Elective subject name label */}
              {electiveName ? (
                <span className="block text-[10px] leading-tight text-muted-foreground truncate w-24 mb-0.5">
                  {electiveName}
                </span>
              ) : null}

              {/* Mark input */}
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={displayValue}
                onChange={(e) =>
                  onMarkChange(
                    row.studentId,
                    subject,
                    e.target.value,
                    initialMark
                  )
                }
                className={`w-20 h-8 text-center text-sm px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                  isInvalid
                    ? "border-red-500 focus-visible:ring-red-500"
                    : isDirty
                      ? "border-amber-400"
                      : ""
                } ${showLow ? "text-amber-600" : ""}`}
                aria-label={`Mark for ${row.studentName} - ${subject}`}
              />

              {/* Error indicator */}
              {isInvalid && (
                <span className="text-[10px] text-red-500 mt-0.5">0–100</span>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

const MarkEntryRow = memo(MarkEntryRowInner);
export default MarkEntryRow;
