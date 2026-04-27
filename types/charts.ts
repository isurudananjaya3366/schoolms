/** Data shape for a single term's marks, used by StudentPerformanceBar */
export interface TermMarkData {
  term: string; // "Term 1", "Term 2", "Term 3"
  termKey: string; // "TERM_1", "TERM_2", "TERM_3"
  [subjectKey: string]: number | null | string; // subject keys have number|null values
}

/** Elective labels resolved from settings */
export interface ElectiveLabels {
  labelI: string;
  labelII: string;
  labelIII: string;
}
