import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (available inside vi.mock factories) ──

const {
  mockConnect,
  mockDisconnect,
  mockSystemConfigCount,
  mockSystemConfigUpsert,
  mockSystemConfigFindUnique,
  mockSystemConfigCreate,
  mockUserFindFirst,
  mockPrismaUserFindFirst,
  mockPrismaUserFindUnique,
  mockPrismaUserCreate,
  mockWriteVercelEnvVar,
  mockCheckDatabaseHealth,
} = vi.hoisted(() => ({
  mockConnect: vi.fn().mockResolvedValue(undefined),
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockSystemConfigCount: vi.fn().mockResolvedValue(0),
  mockSystemConfigUpsert: vi.fn().mockResolvedValue({}),
  mockSystemConfigFindUnique: vi.fn().mockResolvedValue(null),
  mockSystemConfigCreate: vi.fn().mockResolvedValue({}),
  mockUserFindFirst: vi.fn().mockResolvedValue(null),
  mockPrismaUserFindFirst: vi.fn().mockResolvedValue(null),
  mockPrismaUserFindUnique: vi.fn().mockResolvedValue(null),
  mockPrismaUserCreate: vi.fn().mockResolvedValue({ id: "mock-id" }),
  mockWriteVercelEnvVar: vi
    .fn()
    .mockResolvedValue({ success: true, method: "local-file" }),
  mockCheckDatabaseHealth: vi.fn(),
}));

// ─── Mocks ──────────────────────────────────────────────

vi.mock("@prisma/client", () => ({
  PrismaClient: class MockPrismaClient {
    $connect = mockConnect;
    $disconnect = mockDisconnect;
    systemConfig = {
      count: mockSystemConfigCount,
      upsert: mockSystemConfigUpsert,
      findUnique: mockSystemConfigFindUnique,
      create: mockSystemConfigCreate,
    };
    user = {
      findFirst: mockUserFindFirst,
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findFirst: mockPrismaUserFindFirst,
      findUnique: mockPrismaUserFindUnique,
      create: mockPrismaUserCreate,
    },
  },
}));

vi.mock("@/lib/vercel-env", () => ({
  writeVercelEnvVar: (...args: unknown[]) => mockWriteVercelEnvVar(...args),
}));

vi.mock("@/lib/db-health", () => ({
  checkDatabaseHealth: (...args: unknown[]) =>
    mockCheckDatabaseHealth(...args),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

// Rate limiter - inline re-implementation for test isolation
vi.mock("@/lib/rate-limiter", () => {
  const store = new Map<string, { count: number; windowStart: number }>();
  return {
    checkRateLimit: (ip: string, maxAttempts = 5, windowMs = 3600000) => {
      const now = Date.now();
      const entry = store.get(ip);
      if (!entry || now > entry.windowStart + windowMs) {
        store.set(ip, { count: 1, windowStart: now });
        return {
          allowed: true,
          remaining: maxAttempts - 1,
          resetAt: new Date(now + windowMs),
        };
      }
      if (entry.count >= maxAttempts) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(entry.windowStart + windowMs),
        };
      }
      entry.count += 1;
      return {
        allowed: true,
        remaining: maxAttempts - entry.count,
        resetAt: new Date(entry.windowStart + windowMs),
      };
    },
    __resetStore: () => store.clear(),
  };
});

// ─── Imports ─────────────────────────────────────────────

import { POST as connectHandler } from "@/app/api/config/connect/route";
import { POST as superadminHandler } from "@/app/api/config/superadmin/route";
import { GET as healthHandler } from "@/app/api/config/health/route";
import { NextRequest } from "next/server";

// Helper to import the mocked rate limiter's reset function
async function resetRateLimiter() {
  const mod = await import("@/lib/rate-limiter");
  if ("__resetStore" in mod) {
    (mod as unknown as { __resetStore: () => void }).__resetStore();
  }
}

function buildRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options;
  const reqInit: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
  };
  if (body) {
    reqInit.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), reqInit);
}

// ─── Tests ───────────────────────────────────────────────

describe("Config API Integration Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRateLimiter();

    // Reset default mock behaviors
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockSystemConfigCount.mockResolvedValue(0);
    mockUserFindFirst.mockResolvedValue(null);
    mockSystemConfigFindUnique.mockResolvedValue(null);
    mockWriteVercelEnvVar.mockResolvedValue({
      success: true,
      method: "local-file",
    });
    mockPrismaUserFindFirst.mockResolvedValue(null);
    mockPrismaUserFindUnique.mockResolvedValue(null);
    mockPrismaUserCreate.mockResolvedValue({ id: "mock-id" });
  });

  // Test 1 - Valid connection, no existing superadmin
  it("POST /api/config/connect - valid connection, no superadmin → 200 { connected, needsSuperadmin }", async () => {
    const req = buildRequest("/api/config/connect", {
      method: "POST",
      body: { connectionString: "mongodb+srv://user:pass@cluster0.abc.mongodb.net/schoolms" },
    });

    const res = await connectHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connected).toBe(true);
    expect(data.needsSuperadmin).toBe(true);
  });

  // Test 2 - Invalid connection string format
  it("POST /api/config/connect - invalid connection string → 400", async () => {
    const req = buildRequest("/api/config/connect", {
      method: "POST",
      body: { connectionString: "not-a-valid-string" },
    });

    const res = await connectHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  // Test 3 - Rate limit exceeded
  it("POST /api/config/connect - rate limit exceeded on 6th call → 429", async () => {
    const validBody = {
      connectionString: "mongodb+srv://user:pass@cluster0.abc.mongodb.net/db",
    };

    // Make 5 successful calls
    for (let i = 0; i < 5; i++) {
      const req = buildRequest("/api/config/connect", {
        method: "POST",
        body: validBody,
        headers: { "x-forwarded-for": "10.0.0.99" },
      });
      await connectHandler(req);
    }

    // 6th call should be rate limited
    const req = buildRequest("/api/config/connect", {
      method: "POST",
      body: validBody,
      headers: { "x-forwarded-for": "10.0.0.99" },
    });

    const res = await connectHandler(req);
    expect(res.status).toBe(429);
  });

  // Test 4 - PrismaClient $connect() throws with credentials in error
  it("POST /api/config/connect - connection error, no credentials in response", async () => {
    mockConnect.mockRejectedValueOnce(
      new Error(
        "Connection failed: mongodb+srv://secretuser:secretpass@cluster0.abc.mongodb.net/db"
      )
    );

    const req = buildRequest("/api/config/connect", {
      method: "POST",
      body: { connectionString: "mongodb+srv://secretuser:secretpass@cluster0.abc.mongodb.net/db" },
    });

    const res = await connectHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).not.toContain("secretuser");
    expect(data.error).not.toContain("secretpass");
    expect(data.error).toContain("[credentials-redacted]");
  });

  // Test 5 - Valid superadmin creation
  it("POST /api/config/superadmin - valid data → 200 { success }", async () => {
    const req = buildRequest("/api/config/superadmin", {
      method: "POST",
      body: {
        name: "Admin User",
        email: "admin@school.com",
        password: "securepass123",
        confirmPassword: "securepass123",
      },
    });

    const res = await superadminHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  // Test 6 - Passwords don't match
  it("POST /api/config/superadmin - passwords don't match → 400", async () => {
    const req = buildRequest("/api/config/superadmin", {
      method: "POST",
      body: {
        name: "Admin User",
        email: "admin@school.com",
        password: "securepass123",
        confirmPassword: "differentpass",
      },
    });

    const res = await superadminHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("match");
  });

  // Test 7 - Email already exists
  it("POST /api/config/superadmin - email already exists → 400", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce({
      id: "existing-id",
      email: "admin@school.com",
    });

    const req = buildRequest("/api/config/superadmin", {
      method: "POST",
      body: {
        name: "Admin User",
        email: "admin@school.com",
        password: "securepass123",
        confirmPassword: "securepass123",
      },
    });

    const res = await superadminHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("email");
  });

  // Test 8 - GET /api/config/health, DB healthy
  it("GET /api/config/health - healthy → correct shape, no DATABASE_URL", async () => {
    mockCheckDatabaseHealth.mockResolvedValueOnce({
      status: "healthy",
      latencyMs: 42,
      collectionCounts: {
        users: 1,
        classGroups: 3,
        students: 25,
        markRecords: 100,
        systemConfigs: 3,
      },
      errorMessage: null,
      clusterName: "cluster0.abc.mongodb.net",
    });

    const res = await healthHandler();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.latencyMs).toBe(42);
    expect(data.collectionCounts).toBeDefined();
    expect(data.clusterName).toBe("cluster0.abc.mongodb.net");
    expect(JSON.stringify(data)).not.toContain("DATABASE_URL");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // Test 9 - GET /api/config/health, DB unreachable, credentials stripped
  it("GET /api/config/health - unreachable → credentials stripped from error", async () => {
    mockCheckDatabaseHealth.mockResolvedValueOnce({
      status: "unreachable",
      latencyMs: null,
      collectionCounts: null,
      errorMessage:
        "Connection failed: mongodb+srv://admin:s3cret@cluster0.abc.mongodb.net/db",
      clusterName: "cluster0.abc.mongodb.net",
    });

    const res = await healthHandler();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("unreachable");
    expect(data.errorMessage).not.toContain("admin");
    expect(data.errorMessage).not.toContain("s3cret");
    expect(data.errorMessage).toContain("[credentials-redacted]");
  });
});
