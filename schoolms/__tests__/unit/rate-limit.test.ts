import { describe, it, expect, vi, beforeEach } from "vitest";

function createMockRequest(ip: string = "127.0.0.1"): Request {
  return new Request("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("Rate Limit", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure UPSTASH env vars are not set so we use in-memory fallback
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows requests under the limit", async () => {
    const { withRateLimit } = await import("@/lib/rate-limit");
    const req = createMockRequest("1.2.3.4");
    const result = await withRateLimit(req, "test-allow", 5, 60);
    expect(result).toBeNull();
  });

  it("blocks requests over the limit", async () => {
    const { withRateLimit } = await import("@/lib/rate-limit");
    const ip = "5.6.7.8";
    for (let i = 0; i < 5; i++) {
      const res = await withRateLimit(
        createMockRequest(ip),
        "test-block",
        5,
        60
      );
      expect(res).toBeNull();
    }
    const limited = await withRateLimit(
      createMockRequest(ip),
      "test-block",
      5,
      60
    );
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
  });

  it("tracks different IPs independently", async () => {
    const { withRateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 5; i++) {
      await withRateLimit(createMockRequest("10.0.0.1"), "test-ip", 5, 60);
    }
    const result = await withRateLimit(
      createMockRequest("10.0.0.2"),
      "test-ip",
      5,
      60
    );
    expect(result).toBeNull();
  });

  it("tracks different key prefixes independently", async () => {
    const { withRateLimit } = await import("@/lib/rate-limit");
    const ip = "20.0.0.1";
    for (let i = 0; i < 5; i++) {
      await withRateLimit(createMockRequest(ip), "prefix-a", 5, 60);
    }
    const result = await withRateLimit(
      createMockRequest(ip),
      "prefix-b",
      5,
      60
    );
    expect(result).toBeNull();
  });
});
