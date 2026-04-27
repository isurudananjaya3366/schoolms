import { describe, it, expect } from "vitest";
import { applyWRule, isWMark, getWSubjects } from "@/lib/w-rule";

// ─── applyWRule ──────────────────────────────────────────

describe("applyWRule", () => {
  it("returns em dash for null", () => {
    expect(applyWRule(null)).toBe("\u2014");
  });

  it("returns em dash for undefined", () => {
    expect(applyWRule(undefined)).toBe("\u2014");
  });

  it('returns "W" for 0', () => {
    expect(applyWRule(0)).toBe("W");
  });

  it('returns "W" for 34', () => {
    expect(applyWRule(34)).toBe("W");
  });

  it('returns "35" for 35', () => {
    expect(applyWRule(35)).toBe("35");
  });

  it('returns "50" for 50', () => {
    expect(applyWRule(50)).toBe("50");
  });

  it('returns "100" for 100', () => {
    expect(applyWRule(100)).toBe("100");
  });
});

// ─── isWMark ─────────────────────────────────────────────

describe("isWMark", () => {
  it("returns false for null", () => {
    expect(isWMark(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isWMark(undefined)).toBe(false);
  });

  it("returns true for 0", () => {
    expect(isWMark(0)).toBe(true);
  });

  it("returns true for 34", () => {
    expect(isWMark(34)).toBe(true);
  });

  it("returns false for 35", () => {
    expect(isWMark(35)).toBe(false);
  });

  it("returns false for 100", () => {
    expect(isWMark(100)).toBe(false);
  });
});

// ─── getWSubjects ────────────────────────────────────────

const defaultElectives = {
  categoryI: "Geography",
  categoryII: "Art",
  categoryIII: "Drama",
};

function allNullMarks(): Record<string, number | null> {
  return {
    sinhala: null,
    buddhism: null,
    maths: null,
    science: null,
    english: null,
    history: null,
    categoryI: null,
    categoryII: null,
    categoryIII: null,
  };
}

describe("getWSubjects", () => {
  it("returns empty array when all marks are null", () => {
    expect(getWSubjects(allNullMarks(), defaultElectives)).toEqual([]);
  });

  it("returns [Maths] when maths=34 and sinhala=35", () => {
    const marks = { ...allNullMarks(), maths: 34, sinhala: 35 };
    expect(getWSubjects(marks, defaultElectives)).toEqual(["Maths"]);
  });

  it("returns elective display name when categoryI=20", () => {
    const marks = { ...allNullMarks(), categoryI: 20 };
    expect(getWSubjects(marks, defaultElectives)).toEqual(["Geography"]);
  });

  it("returns multiple failing subjects in canonical order", () => {
    const marks = {
      ...allNullMarks(),
      sinhala: 10,
      buddhism: 20,
      maths: 30,
      english: 35,
    };
    expect(getWSubjects(marks, defaultElectives)).toEqual([
      "Sinhala",
      "Buddhism",
      "Maths",
    ]);
  });
});
