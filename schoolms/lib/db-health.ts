import prisma from "@/lib/prisma";

export interface DatabaseHealthResult {
  status: "healthy" | "unreachable" | "unconfigured";
  latencyMs: number | null;
  collectionCounts: {
    users: number;
    classGroups: number;
    students: number;
    markRecords: number;
    systemConfigs: number;
  } | null;
  errorMessage: string | null;
  clusterName: string | null;
}

function sanitizeError(message: string): string {
  return message.replace(
    /mongodb(\+srv)?:\/\/[^@]*@/gi,
    "mongodb$1://***:***@"
  );
}

function extractClusterName(url: string): string | null {
  try {
    const withoutProtocol = url.replace(/^mongodb(\+srv)?:\/\//, "");
    const withoutCredentials = withoutProtocol.replace(/^[^@]*@/, "");
    const hostname = withoutCredentials.split("/")[0].split("?")[0];
    return hostname || null;
  } catch {
    return null;
  }
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const databaseUrl = process.env.DATABASE_URL;

  // Step 1: Check if DATABASE_URL is configured
  if (!databaseUrl) {
    return {
      status: "unconfigured",
      latencyMs: null,
      collectionCounts: null,
      errorMessage: null,
      clusterName: null,
    };
  }

  try {
    // Step 2: Check if db_configured key exists in SystemConfig
    const configEntry = await prisma.systemConfig.findUnique({
      where: { key: "db_configured" },
    });

    if (!configEntry || configEntry.value !== "true") {
      return {
        status: "unconfigured",
        latencyMs: null,
        collectionCounts: null,
        errorMessage: null,
        clusterName: extractClusterName(databaseUrl),
      };
    }

    // Step 3: Measure latency
    const start = performance.now();
    await prisma.user.count();
    const latencyMs = Math.round(performance.now() - start);

    // Step 4: Get all 5 collection counts
    const [users, classGroups, students, markRecords, systemConfigs] =
      await Promise.all([
        prisma.user.count(),
        prisma.classGroup.count(),
        prisma.student.count(),
        prisma.markRecord.count(),
        prisma.systemConfig.count(),
      ]);

    // Step 5: Extract cluster name
    const clusterName = extractClusterName(databaseUrl);

    return {
      status: "healthy",
      latencyMs,
      collectionCounts: {
        users,
        classGroups,
        students,
        markRecords,
        systemConfigs,
      },
      errorMessage: null,
      clusterName,
    };
  } catch (error) {
    // Step 6: On any error → return unreachable
    const rawMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      status: "unreachable",
      latencyMs: null,
      collectionCounts: null,
      errorMessage: sanitizeError(rawMessage),
      clusterName: extractClusterName(databaseUrl),
    };
  }
}
