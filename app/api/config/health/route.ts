import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db-health";
import { sanitizeMongoUri } from "@/lib/utils";

export async function GET() {
  try {
    const health = await checkDatabaseHealth();

    // Final sanitization pass on errorMessage
    if (health.errorMessage) {
      health.errorMessage = sanitizeMongoUri(health.errorMessage);
    }

    return NextResponse.json(health, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "unreachable",
        latencyMs: null,
        collectionCounts: null,
        errorMessage: sanitizeMongoUri(rawMessage),
        clusterName: null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
