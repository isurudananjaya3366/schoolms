import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ViewMarksClient from "@/components/marks/ViewMarksClient";

export const metadata = { title: "View Marks | SchoolMS" };

export default async function ViewMarksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;

  return (
    <ViewMarksClient
      role={session.user.role as string}
      userId={session.user.id}
      initialParams={{
        grade: typeof params.grade === "string" ? params.grade : undefined,
        classId:
          typeof params.classId === "string" ? params.classId : undefined,
        term: typeof params.term === "string" ? params.term : undefined,
        year: typeof params.year === "string" ? params.year : undefined,
        studentId:
          typeof params.studentId === "string" ? params.studentId : undefined,
      }}
    />
  );
}
