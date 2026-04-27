import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export const metadata = { title: "My Profile | SchoolMS" };

export default async function StudentProfilePage() {
  const session = await auth();

  if (!session?.user) redirect("/login");

  // Only STUDENT role accesses this page
  if (session.user.role !== Role.STUDENT) {
    redirect("/dashboard");
  }

  // Try to load linked student profile if one exists
  let student = null;
  if (session.user.linkedStudentId) {
    student = await prisma.student.findUnique({
      where: { id: session.user.linkedStudentId },
      include: { class: true },
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Student Portal</h1>
          <p className="text-muted-foreground">Welcome, {session.user.name}</p>
        </div>

        {student ? (
          <div className="rounded-lg border p-6 space-y-3">
            <h2 className="font-semibold text-lg">{student.name}</h2>
            {student.indexNumber && (
              <p className="text-sm text-muted-foreground">
                Index: {student.indexNumber}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Class: Grade {student.class.grade}{student.class.section}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No student profile linked to this account yet.
            <br />
            Please contact your administrator.
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Full student portal coming soon.
        </p>
      </div>
    </div>
  );
}
