import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the prisma module before importing the function under test
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      systemConfig: { findUnique: vi.fn() },
      user: { count: vi.fn() },
      classGroup: { count: vi.fn() },
      student: { count: vi.fn() },
      markRecord: { count: vi.fn() },
      systemConfig2: { count: vi.fn() },
    },
  };
});

import { checkDatabaseHealth } from "@/lib/db-health";
import prisma from "@/lib/prisma";

// Helper to set DATABASE_URL for a test
function setDatabaseUrl(url: string | undefined) {
  if (url === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = url;
  }
}

// Typed mock references
const mockSystemConfigFindUnique = prisma.systemConfig
  .findUnique as ReturnType<typeof vi.fn>;
const mockUserCount = prisma.user.count as ReturnType<typeof vi.fn>;
const mockClassGroupCount = prisma.classGroup.count as ReturnType<
  typeof vi.fn
>;
const mockStudentCount = prisma.student.count as ReturnType<typeof vi.fn>;
const mockMarkRecordCount = prisma.markRecord.count as ReturnType<
  typeof vi.fn
>;

// We need systemConfig.count too - patch it onto the mock
const mockSystemConfigCount = vi.fn();
(prisma.systemConfig as unknown as Record<string, unknown>).count =
  mockSystemConfigCount;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkDatabaseHealth", () => {
  it("returns unconfigured when DATABASE_URL is empty", async () => {
    setDatabaseUrl("");

    const result = await checkDatabaseHealth();

    expect(result.status).toBe("unconfigured");
    expect(result.latencyMs).toBeNull();
    expect(result.collectionCounts).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.clusterName).toBeNull();
  });

  it("returns healthy when database is reachable and configured", async () => {
    setDatabaseUrl("mongodb+srv://user:pass@cluster0.abc.mongodb.net/schoolms");

    mockSystemConfigFindUnique.mockResolvedValue({
      id: "1",
      key: "db_configured",
      value: "true",
      updatedAt: new Date(),
    });
    mockUserCount.mockResolvedValue(5);
    mockClassGroupCount.mockResolvedValue(3);
    mockStudentCount.mockResolvedValue(100);
    mockMarkRecordCount.mockResolvedValue(50);
    mockSystemConfigCount.mockResolvedValue(2);

    const result = await checkDatabaseHealth();

    expect(result.status).toBe("healthy");
    expect(result.latencyMs).toBeTypeOf("number");
    expect(result.collectionCounts).toEqual({
      users: 5,
      classGroups: 3,
      students: 100,
      markRecords: 50,
      systemConfigs: 2,
    });
    expect(result.errorMessage).toBeNull();
    expect(result.clusterName).toBe("cluster0.abc.mongodb.net");
  });

  it("returns unreachable with sanitized error when database throws", async () => {
    setDatabaseUrl("mongodb+srv://admin:secret123@cluster0.abc.mongodb.net/schoolms");

    mockSystemConfigFindUnique.mockRejectedValue(
      new Error(
        "Can't reach database at mongodb+srv://admin:secret123@cluster0.abc.mongodb.net"
      )
    );

    const result = await checkDatabaseHealth();

    expect(result.status).toBe("unreachable");
    expect(result.latencyMs).toBeNull();
    expect(result.collectionCounts).toBeNull();
    expect(result.errorMessage).not.toContain("admin");
    expect(result.errorMessage).not.toContain("secret123");
    expect(result.errorMessage).toContain("***:***@");
    expect(result.clusterName).toBe("cluster0.abc.mongodb.net");
  });
});
