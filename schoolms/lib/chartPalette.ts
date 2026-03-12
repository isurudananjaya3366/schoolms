/**
 * Shared chart colour palette for SchoolMS
 * Subjects are always assigned colours by their position in the canonical order.
 */

// Canonical subject key order (must match schema Marks field order)
export const SUBJECT_KEYS = [
  "sinhala", "buddhism", "maths", "science", "english", "history",
  "categoryI", "categoryII", "categoryIII",
] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];

// Core subject display names (electives resolved from settings)
export const CORE_SUBJECT_NAMES: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Maths",
  science: "Science",
  english: "English",
  history: "History",
};

// Fixed palette — 12 distinct colours, subjects assigned by index
export const PALETTE: string[] = [
  "#2563eb", // blue — Sinhala
  "#7c3aed", // violet — Buddhism
  "#059669", // emerald — Maths
  "#d97706", // amber — Science
  "#dc2626", // red — English
  "#0891b2", // cyan — History
  "#c026d3", // fuchsia — Category I
  "#ea580c", // orange — Category II
  "#4f46e5", // indigo — Category III
  "#16a34a", // green (spare)
  "#9333ea", // purple (spare)
  "#0d9488", // teal (spare)
];

// W-override colour for bars below threshold
export const W_BAR_COLOR = "#ef4444"; // red-500

// Performance threshold colours (for analytics charts)
export const THRESHOLD_COLORS = {
  fail: "#dc2626",    // red — below 35
  atRisk: "#d97706",  // amber — 35-49
  pass: "#16a34a",    // green — 50+
} as const;

// Reverse lookup: display name → palette index for core subjects
const CORE_DISPLAY_TO_INDEX: Record<string, number> = {};
SUBJECT_KEYS.forEach((key, idx) => {
  if (CORE_SUBJECT_NAMES[key]) {
    CORE_DISPLAY_TO_INDEX[CORE_SUBJECT_NAMES[key]] = idx;
  }
});

/**
 * Get the palette colour for a subject by its key OR display name.
 * Core subjects match by key or display name; electives use a stable hash.
 * Falls back to cycling through palette if index exceeds palette size.
 */
export function getSubjectColor(subjectKey: string): string {
  // Match by raw key (e.g. "sinhala")
  const idx = SUBJECT_KEYS.indexOf(subjectKey as SubjectKey);
  if (idx >= 0) return PALETTE[idx];
  // Match by display name (e.g. "Sinhala")
  if (subjectKey in CORE_DISPLAY_TO_INDEX) return PALETTE[CORE_DISPLAY_TO_INDEX[subjectKey]];
  // Fallback: hash the key to a palette index
  const hash = subjectKey.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

/**
 * Resolve subject display name from key.
 * Elective labels must be provided from settings.
 */
export function getSubjectDisplayName(
  key: string,
  electiveLabels?: { labelI: string; labelII: string; labelIII: string }
): string {
  if (CORE_SUBJECT_NAMES[key]) return CORE_SUBJECT_NAMES[key];
  if (key === "categoryI") return electiveLabels?.labelI || "Category I";
  if (key === "categoryII") return electiveLabels?.labelII || "Category II";
  if (key === "categoryIII") return electiveLabels?.labelIII || "Category III";
  return key;
}
