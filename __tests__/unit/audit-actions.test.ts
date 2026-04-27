import { describe, it, expect } from "vitest";
import * as actions from "@/lib/audit-actions";

describe("Audit Actions", () => {
  const allActions = Object.values(actions);

  it("exports at least 15 action constants", () => {
    expect(allActions.length).toBeGreaterThanOrEqual(15);
  });

  it("all action values are uppercase strings", () => {
    for (const action of allActions) {
      expect(typeof action).toBe("string");
      expect(action).toBe((action as string).toUpperCase());
    }
  });

  it("has no duplicate action values", () => {
    const unique = new Set(allActions);
    expect(unique.size).toBe(allActions.length);
  });

  it("includes backup-related actions", () => {
    expect(allActions).toContain("BACKUP_TRIGGERED");
    expect(allActions).toContain("BACKUP_COMPLETED");
    expect(allActions).toContain("BACKUP_FAILED");
    expect(allActions).toContain("RESTORE_TRIGGERED");
  });

  it("includes student management actions", () => {
    expect(allActions).toContain("STUDENT_CREATED");
    expect(allActions).toContain("STUDENT_UPDATED");
    expect(allActions).toContain("STUDENT_DELETED");
  });
});
