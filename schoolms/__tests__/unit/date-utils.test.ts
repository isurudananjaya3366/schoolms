import { describe, it, expect } from "vitest";
import { format, formatDistanceToNow } from "date-fns";

describe("Date Formatting Utilities", () => {
  it("formats a UTC date correctly", () => {
    const date = new Date("2024-06-15T14:30:00Z");
    const formatted = format(date, "MMM dd, yyyy HH:mm:ss");
    expect(formatted).toContain("2024");
    expect(formatted).toContain("Jun");
    expect(formatted).toContain("15");
  });

  it("handles null date gracefully", () => {
    const result = (() => {
      try {
        return format(null as unknown as Date, "yyyy-MM-dd");
      } catch {
        return "—";
      }
    })();
    expect(result).toBe("—");
  });

  it("returns relative time string for past date", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const relative = formatDistanceToNow(threeDaysAgo, { addSuffix: true });
    expect(relative).toContain("days");
    expect(relative).toContain("ago");
  });
});
