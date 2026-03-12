import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import { writeVercelEnvVar } from "@/lib/vercel-env";
import { sanitizeMongoUri } from "@/lib/utils";

const connectSchema = z.object({
  connectionString: z
    .string()
    .min(1, "Connection string is required")
    .refine(
      (val) => val.startsWith("mongodb+srv://") || val.startsWith("mongodb://"),
      "Connection string must start with mongodb+srv:// or mongodb://"
    )
    .refine(
      (val) => val.includes("@") && val.includes("."),
      "Connection string must contain valid host information"
    ),
});

export async function POST(request: NextRequest) {
  let tempClient: PrismaClient | null = null;

  try {
    // Step 1 — Parse and validate
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { connectionString } = parsed.data;

    // Step 2 — Rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many connection attempts. Please try again later.",
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }

    // Step 3 — Test connection with temporary PrismaClient
    tempClient = new PrismaClient({
      datasources: { db: { url: connectionString } },
    });

    try {
      await tempClient.$connect();
      await tempClient.systemConfig.count();
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Unknown connection error";
      return NextResponse.json(
        { error: `Database connection failed: ${sanitizeMongoUri(rawMessage)}` },
        { status: 500 }
      );
    }

    // Step 4 — Schema push: skipped at runtime (build step)
    // Prisma schema is pushed via `npx prisma db push` during deployment

    // Step 5 — Check for existing SUPERADMIN
    const existingSuperadmin = await tempClient.user.findFirst({
      where: { role: "SUPERADMIN" },
    });

    const needsSuperadmin = !existingSuperadmin;

    // Step 6 — Write env vars
    const dbUrlResult = await writeVercelEnvVar("DATABASE_URL", connectionString);
    const dbConfigResult = await writeVercelEnvVar(
      "NEXT_PUBLIC_DB_CONFIGURED",
      "true"
    );

    let envWriteWarning: string | undefined;
    if (dbUrlResult.warning || dbConfigResult.warning) {
      envWriteWarning =
        dbUrlResult.warning || dbConfigResult.warning || undefined;
    }

    // Step 7 — SystemConfig upserts
    const currentYear = new Date().getFullYear().toString();

    await tempClient.systemConfig.upsert({
      where: { key: "db_configured" },
      update: { value: "true" },
      create: { key: "db_configured", value: "true" },
    });

    // Only create if not existing
    const existingAcademicYear = await tempClient.systemConfig.findUnique({
      where: { key: "academic_year" },
    });
    if (!existingAcademicYear) {
      await tempClient.systemConfig.create({
        data: { key: "academic_year", value: currentYear },
      });
    }

    const existingSchoolName = await tempClient.systemConfig.findUnique({
      where: { key: "school_name" },
    });
    if (!existingSchoolName) {
      await tempClient.systemConfig.create({
        data: { key: "school_name", value: "SchoolMS" },
      });
    }

    // Step 8 — Return response
    return NextResponse.json({
      connected: true,
      needsSuperadmin,
      envWriteMethod: dbUrlResult.method,
      envWriteWarning,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: sanitizeMongoUri(rawMessage) },
      { status: 500 }
    );
  } finally {
    if (tempClient) {
      await tempClient.$disconnect();
    }
  }
}
