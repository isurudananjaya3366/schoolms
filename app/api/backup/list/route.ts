import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import { getBackupHistory } from "@/lib/backup";

export async function GET() {
  const authResult = await requireAuth(Role.SUPERADMIN);
  if (authResult instanceof NextResponse) return authResult;
  const history = await getBackupHistory();
  return NextResponse.json(history);
}
