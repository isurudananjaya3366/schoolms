import { describe, it, expect } from "vitest";
import { gzipAsync, gunzipAsync } from "@/lib/backup";

describe("Backup Serialisation", () => {
  it("round-trips data through gzip/gunzip", async () => {
    const original = JSON.stringify({
      students: [{ name: "Test" }],
      meta: { timestamp: new Date().toISOString() },
    });
    const buf = Buffer.from(original, "utf-8");
    const compressed = await gzipAsync(buf);
    expect(compressed.length).toBeLessThan(buf.length + 100);
    const decompressed = await gunzipAsync(compressed);
    expect(decompressed.toString("utf-8")).toBe(original);
  });

  it("handles empty buffer", async () => {
    const empty = Buffer.alloc(0);
    const compressed = await gzipAsync(empty);
    const decompressed = await gunzipAsync(compressed);
    expect(decompressed.length).toBe(0);
  });

  it("preserves backup payload structure through serialisation", async () => {
    const payload = {
      meta: {
        schoolName: "Test School",
        timestamp: new Date().toISOString(),
        collections: {
          students: 5,
          users: 2,
          markRecords: 10,
          systemConfig: 3,
          auditLogs: 20,
        },
      },
      students: [{ id: "1", name: "Alice" }],
      users: [{ id: "2", username: "admin" }],
      markRecords: [],
      systemConfig: [{ key: "school_name", value: "Test" }],
      auditLogs: [{ action: "TEST" }],
    };
    const json = JSON.stringify(payload);
    const compressed = await gzipAsync(Buffer.from(json, "utf-8"));
    const decompressed = await gunzipAsync(compressed);
    const parsed = JSON.parse(decompressed.toString("utf-8"));
    expect(Object.keys(parsed)).toEqual(
      expect.arrayContaining([
        "meta",
        "students",
        "users",
        "markRecords",
        "systemConfig",
        "auditLogs",
      ])
    );
    expect(parsed.meta.schoolName).toBe("Test School");
    expect(parsed.markRecords).toEqual([]);
    expect(parsed.students).toHaveLength(1);
  });

  it("converts Date to ISO string through JSON serialisation", async () => {
    const data = { createdAt: new Date("2024-01-15T10:30:00Z") };
    const json = JSON.stringify(data);
    const compressed = await gzipAsync(Buffer.from(json));
    const decompressed = await gunzipAsync(compressed);
    const parsed = JSON.parse(decompressed.toString("utf-8"));
    expect(parsed.createdAt).toBe("2024-01-15T10:30:00.000Z");
    expect(typeof parsed.createdAt).toBe("string");
  });
});
