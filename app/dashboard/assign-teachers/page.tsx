import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import AssignTeachersClient from "./AssignTeachersClient";

export const metadata = { title: "Assign Teachers | SchoolMS" };

export default async function AssignTeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!(await hasPermission(session.user.role, "assign_teachers"))) {
    redirect("/dashboard");
  }

  // Fetch all class groups
  const classGroups = await prisma.classGroup.findMany({
    orderBy: [{ grade: "asc" }, { section: "asc" }],
    select: { id: true, grade: true, section: true },
  });

  // Fetch all active teacher users
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // Fetch elective options from SystemConfig
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: { in: ["elective_label_I", "elective_label_II", "elective_label_III"] },
    },
    select: { key: true, value: true },
  });
  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));

  function parseElectives(key: string, defaults: string[]): string[] {
    try {
      const raw = configMap[key];
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : defaults;
    } catch {
      return defaults;
    }
  }

  const electiveOptions = {
    catI: parseElectives("elective_label_I", ["Geography", "Civic Studies", "Accounting", "Tamil"]),
    catII: parseElectives("elective_label_II", ["Art", "Dancing", "Music", "Drama & Theatre"]),
    catIII: parseElectives("elective_label_III", ["Health", "ICT", "Agriculture", "Art & Crafts"]),
  };

  return (
    <AssignTeachersClient
      classes={classGroups}
      teachers={teachers}
      electiveOptions={electiveOptions}
    />
  );
}
