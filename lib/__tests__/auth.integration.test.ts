import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────

// Mock Prisma
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: {
    user: mockPrismaUser,
  },
}));

// Mock bcryptjs
const mockBcrypt = {
  compare: vi.fn(),
  hash: vi.fn(),
};

vi.mock("bcryptjs", () => ({
  default: mockBcrypt,
  compare: (...args: unknown[]) => mockBcrypt.compare(...args),
  hash: (...args: unknown[]) => mockBcrypt.hash(...args),
}));

// Mock sendEmail
const mockSendEmail = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ─── Extract authorize function ───────────────────────────

// We import the auth config indirectly. Since NextAuth is a factory,
// we mock it to capture the config and extract authorize.
let capturedAuthorize: (
  credentials: Record<string, unknown>
) => Promise<unknown>;

vi.mock("next-auth", () => {
  return {
    default: (config: {
      providers: Array<{
        options?: { authorize?: typeof capturedAuthorize };
      }>;
    }) => {
      // Extract authorize from Credentials provider
      const credProv = config.providers[0];
      if (credProv?.options?.authorize) {
        capturedAuthorize = credProv.options.authorize;
      }
      return {
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      };
    },
  };
});

vi.mock("next-auth/providers/credentials", () => {
  return {
    default: (opts: Record<string, unknown>) => ({ options: opts }),
  };
});

vi.mock("zod", async () => {
  const actual = await vi.importActual("zod");
  return actual;
});

// Import auth.ts to trigger NextAuth() call and capture authorize
beforeEach(async () => {
  vi.resetModules();
  mockPrismaUser.findUnique.mockReset();
  mockPrismaUser.update.mockReset();
  mockBcrypt.compare.mockReset();
  mockBcrypt.hash.mockReset();
  mockSendEmail.mockReset();

  // Re-import to re-run the factory and capture authorize
  await import("@/lib/auth");
});

// ─── Test Suite: authorize ────────────────────────────────

describe("authorize (Credentials Provider)", () => {
  it("returns user object (without passwordHash) for valid credentials", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@school.lk",
      name: "Admin",
      role: "ADMIN",
      passwordHash: "$2a$12$hashedpassword",
    };

    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);

    const result = await capturedAuthorize({
      email: "admin@school.lk",
      password: "correctpassword",
    });

    expect(result).toEqual({
      id: "user-1",
      email: "admin@school.lk",
      name: "Admin",
      role: "ADMIN",
    });
    // Should NOT include passwordHash
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("returns null for wrong password", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@school.lk",
      name: "Admin",
      role: "ADMIN",
      passwordHash: "$2a$12$hashedpassword",
    };

    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);

    const result = await capturedAuthorize({
      email: "admin@school.lk",
      password: "wrongpassword",
    });

    expect(result).toBeNull();
  });

  it("returns null for unknown email, bcrypt.compare not called", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);

    const result = await capturedAuthorize({
      email: "unknown@school.lk",
      password: "somepassword",
    });

    expect(result).toBeNull();
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns null for Zod validation failure (bad email format)", async () => {
    const result = await capturedAuthorize({
      email: "not-an-email",
      password: "somepassword",
    });

    expect(result).toBeNull();
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });
});

// ─── Test Suite: forgot-password route ────────────────────

describe("forgot-password API route", () => {
  it("calls Prisma update and sendEmail for existing user", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@school.lk",
      name: "Admin",
      passwordResetExpiry: null,
    };

    mockPrismaUser.findUnique.mockResolvedValue(mockUser);
    mockBcrypt.hash.mockResolvedValue("hashed-token");
    mockPrismaUser.update.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    // Dynamically import the route handler
    const { POST } = await import(
      "@/app/api/auth/forgot-password/route"
    );

    const request = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.168.1.100",
      },
      body: JSON.stringify({ email: "admin@school.lk" }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    // Prisma update should have been called with hashed token
    expect(mockPrismaUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordResetToken: "hashed-token",
        }),
      })
    );

    // sendEmail should have been called
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@school.lk",
        subject: expect.stringContaining("Password Reset"),
      })
    );
  });
});

// ─── Test Suite: reset-password route ─────────────────────

describe("reset-password API route", () => {
  it("updates user with new hash and clears reset fields for valid token", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1hr from now

    mockPrismaUser.findUnique.mockResolvedValue({
      id: "user-1",
      passwordResetToken: "$2a$10$hashedtoken",
      passwordResetExpiry: futureDate,
      passwordHash: "$2a$12$oldpasswordhash",
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockBcrypt.hash.mockResolvedValue("$2a$12$newpasswordhash");
    mockPrismaUser.update.mockResolvedValue({});

    const { POST } = await import(
      "@/app/api/auth/reset-password/route"
    );

    const request = new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "raw-token-value",
        email: "admin@school.lk",
        newPassword: "newsecurepassword",
        confirmPassword: "newsecurepassword",
      }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    // Check Prisma update was called with correct data
    expect(mockPrismaUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordHash: "$2a$12$newpasswordhash",
          passwordResetToken: null,
          passwordResetExpiry: null,
          sessionInvalidatedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns 400 for expired token without updating user", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1hr ago

    mockPrismaUser.findUnique.mockResolvedValue({
      id: "user-1",
      passwordResetToken: "$2a$10$hashedtoken",
      passwordResetExpiry: pastDate,
      passwordHash: "$2a$12$oldpasswordhash",
    });

    const { POST } = await import(
      "@/app/api/auth/reset-password/route"
    );

    const request = new Request("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "raw-token-value",
        email: "admin@school.lk",
        newPassword: "newsecurepassword",
        confirmPassword: "newsecurepassword",
      }),
    });

    const response = await POST(request as never);
    expect(response.status).toBe(400);

    // Prisma update should NOT have been called
    expect(mockPrismaUser.update).not.toHaveBeenCalled();
  });
});
