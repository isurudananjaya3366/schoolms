import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextResponse } from "next/server";

// ---------- helpers ----------

/** Build a minimal NextRequest-like object the middleware logic consumes. */
function buildReq(
  pathname: string,
  search = ""
): {
  nextUrl: { pathname: string; search: string };
  url: string;
  auth: { user: { id: string; email: string; name: string; role: string } } | null;
} {
  const base = "http://localhost:3000";
  return {
    nextUrl: { pathname, search },
    url: `${base}${pathname}${search}`,
    auth: null, // overridden per-test
  };
}

/**
 * The pure route-matching logic extracted from middleware.ts so it
 * can be unit-tested without the NextAuth `auth()` wrapper.
 */
function middlewareLogic(
  req: ReturnType<typeof buildReq>
): NextResponse | undefined {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // /api/config/health - always public
  if (pathname === "/api/config/health") {
    return NextResponse.next();
  }

  // /api/auth/* - pass through
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // /config path logic
  if (pathname === "/config") {
    const dbConfigured = process.env.NEXT_PUBLIC_DB_CONFIGURED;
    if (dbConfigured !== "true") {
      return NextResponse.next();
    }
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        encodeURIComponent(pathname)
      );
      return NextResponse.redirect(loginUrl);
    }
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // /dashboard/* - require authentication
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        encodeURIComponent(pathname + req.nextUrl.search)
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // /api/* (other) - require auth, return 401 JSON
  if (pathname.startsWith("/api")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// ---------- mock auth for requireAuth tests ----------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));

// ---------- suites ----------

describe("Middleware route logic - /dashboard/ path protection", () => {
  it("Case 1: /dashboard with no session → redirect to /login with callbackUrl", () => {
    const req = buildReq("/dashboard");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(307);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl");
    // searchParams.set encodes encodeURIComponent("/dashboard") → %252Fdashboard
    expect(location).toContain("%252Fdashboard");
  });

  it("Case 2: /dashboard/students with STAFF session → pass through", () => {
    const req = buildReq("/dashboard/students");
    req.auth = { user: { id: "1", email: "s@x.com", name: "Staff", role: "STAFF" } };
    const res = middlewareLogic(req);

    // NextResponse.next() returns a 200
    expect(res?.status).toBe(200);
    expect(res?.headers.get("location")).toBeNull();
  });

  it("Case 3: /dashboard?view=list with no session → callbackUrl properly encoded", () => {
    const req = buildReq("/dashboard", "?view=list");
    req.url = "http://localhost:3000/dashboard?view=list";
    const res = middlewareLogic(req);

    expect(res?.status).toBe(307);
    const location = res?.headers.get("location") ?? "";
    // Double-encoded: encodeURIComponent("/dashboard?view=list") → "%2Fdashboard%3Fview%3Dlist"
    // then searchParams.set encodes it again → "%252Fdashboard%253Fview%253Dlist"
    expect(location).toContain("%252Fdashboard%253Fview%253Dlist");
  });
});

describe("Middleware route logic - /api/ path protection", () => {
  it("Case 4: /api/students with no session → 401 JSON", async () => {
    const req = buildReq("/api/students");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(401);
    const body = await res?.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("Case 5: /api/marks with STAFF session → pass through", () => {
    const req = buildReq("/api/marks");
    req.auth = { user: { id: "1", email: "s@x.com", name: "Staff", role: "STAFF" } };
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
  });

  it("Case 6: /api/auth/callback → pass through (not intercepted)", () => {
    const req = buildReq("/api/auth/callback");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
    expect(res?.headers.get("location")).toBeNull();
  });

  it("Case 7: /api/config/health → pass through without auth", () => {
    const req = buildReq("/api/config/health");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
    expect(res?.headers.get("location")).toBeNull();
  });
});

describe("Middleware route logic - /config path protection", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DB_CONFIGURED;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DB_CONFIGURED;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_DB_CONFIGURED = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_DB_CONFIGURED;
    }
  });

  it("Case 8: DB_CONFIGURED=undefined, no session → pass through", () => {
    const req = buildReq("/config");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
  });

  it("Case 9: DB_CONFIGURED='false', no session → pass through", () => {
    process.env.NEXT_PUBLIC_DB_CONFIGURED = "false";
    const req = buildReq("/config");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
  });

  it("Case 10: DB_CONFIGURED='true', no session → redirect to /login", () => {
    process.env.NEXT_PUBLIC_DB_CONFIGURED = "true";
    const req = buildReq("/config");
    const res = middlewareLogic(req);

    expect(res?.status).toBe(307);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("/login");
  });

  it("Case 11: DB_CONFIGURED='true', ADMIN session → redirect to /dashboard", () => {
    process.env.NEXT_PUBLIC_DB_CONFIGURED = "true";
    const req = buildReq("/config");
    req.auth = { user: { id: "2", email: "a@x.com", name: "Admin", role: "ADMIN" } };
    const res = middlewareLogic(req);

    expect(res?.status).toBe(307);
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("/dashboard");
  });

  it("Case 12: DB_CONFIGURED='true', SUPERADMIN session → pass through", () => {
    process.env.NEXT_PUBLIC_DB_CONFIGURED = "true";
    const req = buildReq("/config");
    req.auth = { user: { id: "3", email: "sa@x.com", name: "Super", role: "SUPERADMIN" } };
    const res = middlewareLogic(req);

    expect(res?.status).toBe(200);
  });
});

describe("requireAuth helper", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
  });

  async function getRequireAuth() {
    const mod = await import("@/lib/auth-guard");
    return mod.requireAuth;
  }

  it("Case 13: auth() returns null → 401 NextResponse", async () => {
    mockAuth.mockResolvedValue(null);
    const requireAuth = await getRequireAuth();
    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("Case 14: STAFF role, required ADMIN → 403 NextResponse", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "s@x.com", name: "Staff", role: "STAFF" },
    });
    const requireAuth = await getRequireAuth();
    const result = await requireAuth("ADMIN" as any);

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("Case 15: ADMIN role, required ADMIN → returns user object", async () => {
    const user = { id: "2", email: "a@x.com", name: "Admin", role: "ADMIN" };
    mockAuth.mockResolvedValue({ user });
    const requireAuth = await getRequireAuth();
    const result = await requireAuth("ADMIN" as any);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(user);
  });

  it("Case 16: SUPERADMIN role, required ADMIN → returns user object", async () => {
    const user = { id: "3", email: "sa@x.com", name: "Super", role: "SUPERADMIN" };
    mockAuth.mockResolvedValue({ user });
    const requireAuth = await getRequireAuth();
    const result = await requireAuth("ADMIN" as any);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(user);
  });

  it("Case 17: SUPERADMIN role, no minimum → returns user object", async () => {
    const user = { id: "3", email: "sa@x.com", name: "Super", role: "SUPERADMIN" };
    mockAuth.mockResolvedValue({ user });
    const requireAuth = await getRequireAuth();
    const result = await requireAuth();

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(user);
  });

  it("Case 18: STAFF role, no minimum → returns user object", async () => {
    const user = { id: "1", email: "s@x.com", name: "Staff", role: "STAFF" };
    mockAuth.mockResolvedValue({ user });
    const requireAuth = await getRequireAuth();
    const result = await requireAuth();

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(user);
  });
});
