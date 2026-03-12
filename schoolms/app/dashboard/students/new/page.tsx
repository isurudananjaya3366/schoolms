import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import Link from "next/link";
import AddStudentView from "@/components/students/AddStudentView";

export const metadata = { title: "Add Student | SchoolMS" };

export default async function AddStudentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STAFF") redirect("/dashboard/students");

  // Fetch class groups
  const classGroups = await prisma.classGroup.findMany({
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });

  // Fetch elective labels from SystemConfig
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: ["elective_label_I", "elective_label_II", "elective_label_III"] } },
  });
  const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

  function parseSubjects(raw: string | undefined, fallback: string): string[] {
    if (!raw) return [fallback];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* not JSON */ }
    return [raw];
  }

  const electiveOptions = {
    categoryI: { label: "Elective I", subjects: parseSubjects(configMap["elective_label_I"], "Category I") },
    categoryII: { label: "Elective II", subjects: parseSubjects(configMap["elective_label_II"], "Category II") },
    categoryIII: { label: "Elective III", subjects: parseSubjects(configMap["elective_label_III"], "Category III") },
  };

  if (classGroups.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Add Student</h1>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No class groups are configured. Please seed class groups from the{" "}
            <Link href="/dashboard/settings" className="font-medium underline">Settings page</Link>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AddStudentView
      availableClasses={classGroups.map(c => ({ id: c.id, grade: c.grade, section: c.section }))}
      electiveOptions={electiveOptions}
    />
  );
}
