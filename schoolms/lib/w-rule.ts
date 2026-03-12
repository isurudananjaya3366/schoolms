export const W_THRESHOLD = 35;

/**
 * Apply the W-rule to a mark value.
 * null/undefined → em dash, <35 → "W", ≥35 → string of mark
 */
export function applyWRule(mark: number | null | undefined): string {
  if (mark === null || mark === undefined) return "\u2014"; // em dash
  if (mark < W_THRESHOLD) return "W";
  return String(mark);
}

/**
 * Check if a mark falls under the W threshold.
 * null/undefined → false, <35 → true, ≥35 → false
 */
export function isWMark(mark: number | null | undefined): boolean {
  if (mark === null || mark === undefined) return false;
  return mark < W_THRESHOLD;
}

/** Canonical subject key order */
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

/** Static display names for core subjects */
const CORE_SUBJECT_NAMES: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Maths",
  science: "Science",
  english: "English",
  history: "History",
};

/**
 * Get the display names of subjects where the mark is non-null and below the W threshold.
 * Returns names in canonical order.
 */
export function getWSubjects(
  marks: Record<string, number | null | undefined>,
  electives: { categoryI: string; categoryII: string; categoryIII: string }
): string[] {
  const electiveNameMap: Record<string, string> = {
    categoryI: electives.categoryI,
    categoryII: electives.categoryII,
    categoryIII: electives.categoryIII,
  };

  const result: string[] = [];

  for (const key of SUBJECT_KEYS) {
    const mark = marks[key];
    if (mark !== null && mark !== undefined && mark < W_THRESHOLD) {
      const displayName =
        CORE_SUBJECT_NAMES[key] ?? electiveNameMap[key] ?? key;
      result.push(displayName);
    }
  }

  return result;
}
