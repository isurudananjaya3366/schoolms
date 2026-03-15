import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import MarkEntryClient from "@/components/marks/MarkEntryClient";

export default async function MarkEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id } = session.user;

  if (!(await hasPermission(role, "edit_marks"))) redirect("/dashboard");

  let assignedClassId: string | null = null;
  if (role === "TEACHER") {
    const userRecord = await prisma.user.findUnique({
      where: { id },
      select: { assignedClassId: true },
    });
    assignedClassId = userRecord?.assignedClassId ?? null;
  }

  return <MarkEntryClient role={role} assignedClassId={assignedClassId} />;
}
