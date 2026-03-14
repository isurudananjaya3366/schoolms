import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import MarksManagementClient from "@/components/marks/MarksManagementClient";

export default async function MarksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id } = session.user;

  // Only TEACHER, ADMIN, SUPERADMIN can access marks management
  if (role !== "TEACHER" && role !== "ADMIN" && role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  // For TEACHER: get their assigned class id
  let assignedClassId: string | null = null;
  if (role === "TEACHER") {
    const userRecord = await prisma.user.findUnique({
      where: { id },
      select: { assignedClassId: true },
    });
    assignedClassId = userRecord?.assignedClassId ?? null;
  }

  return <MarksManagementClient role={role} assignedClassId={assignedClassId} />;
}
