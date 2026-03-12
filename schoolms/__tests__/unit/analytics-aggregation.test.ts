import { describe, it, expect } from "vitest";

// Test helper functions that replicate analytics logic
function computeSubjectAverage(marks: (number | null)[]): number | null {
  const valid = marks.filter((m): m is number => m !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, m) => sum + m, 0) / valid.length;
}

function getGradeBand(mark: number): string {
  if (mark >= 75) return "A";
  if (mark >= 65) return "B";
  if (mark >= 55) return "C";
  if (mark >= 35) return "S";
  return "W";
}

function getGradeDistribution(marks: number[]): Record<string, number> {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, S: 0, W: 0 };
  for (const m of marks) dist[getGradeBand(m)]++;
  return dist;
}

function getTopN(students: { name: string; avg: number }[], n: number) {
  return [...students].sort((a, b) => b.avg - a.avg).slice(0, n);
}

describe("Analytics Aggregation", () => {
  it("computes subject average correctly", () => {
    expect(computeSubjectAverage([80, 60, 70])).toBeCloseTo(70, 2);
  });

  it("returns null average for all-null marks", () => {
    expect(computeSubjectAverage([null, null, null])).toBeNull();
  });

  it("distributes grades into correct bands", () => {
    const dist = getGradeDistribution([28, 42, 67, 81, 100]);
    expect(dist).toEqual({ A: 2, B: 1, C: 0, S: 1, W: 1 });
  });

  it("extracts top 5 students in correct order", () => {
    const students = Array.from({ length: 10 }, (_, i) => ({
      name: `S${i}`,
      avg: (i + 1) * 10,
    }));
    const top5 = getTopN(students, 5);
    expect(top5).toHaveLength(5);
    expect(top5[0].name).toBe("S9");
    expect(top5[4].name).toBe("S5");
  });

  it("handles empty marks array for average", () => {
    expect(computeSubjectAverage([])).toBeNull();
  });
});
