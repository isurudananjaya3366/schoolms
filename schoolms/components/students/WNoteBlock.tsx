import { Term } from "@prisma/client";
import { getWSubjects } from "@/lib/w-rule";
import { AlertTriangle } from "lucide-react";

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

interface WNoteBlockProps {
  markRecords: MarkRecord[];
  electives: Electives;
}

export default function WNoteBlock({
  markRecords,
  electives,
}: WNoteBlockProps) {
  if (markRecords.length === 0) return null;

  const allWSubjects = new Set<string>();
  for (const record of markRecords) {
    const marksObj: Record<string, number | null | undefined> = {
      sinhala: record.marks.sinhala,
      buddhism: record.marks.buddhism,
      maths: record.marks.maths,
      science: record.marks.science,
      english: record.marks.english,
      history: record.marks.history,
      categoryI: record.marks.categoryI,
      categoryII: record.marks.categoryII,
      categoryIII: record.marks.categoryIII,
    };
    const wSubjects = getWSubjects(marksObj, electives);
    for (const s of wSubjects) allWSubjects.add(s);
  }

  if (allWSubjects.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No W marks recorded for this student.
      </p>
    );
  }

  const sortedSubjects = Array.from(allWSubjects).sort();

  return (
    <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            W-Mark Subjects (Below {35})
          </p>
          <ul className="mt-1.5 list-disc list-inside text-sm text-red-700 font-medium">
            {sortedSubjects.map((subject) => (
              <li key={subject}>{subject}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
