import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import StudentFilterBar from "@/components/students/StudentFilterBar";
import StudentTable from "@/components/students/StudentTable";
import PaginationControl from "@/components/students/PaginationControl";
import Link from "next/link";
import { Plus } from "lucide-react";

const SORT_ALLOWLIST = ["name", "indexNumber", "grade"] as const;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (!(await hasPermission(role, "view_students"))) redirect("/dashboard");

  const [canAddEdit, canDelete] = await Promise.all([
    hasPermission(role, "add_edit_students"),
    hasPermission(role, "delete_students"),
  ]);

  const sp = await searchParams;

  // Parse query params
  const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(sp.limit ?? "20"), 10) || 20)
  );
  const gradeParam = sp.grade ? parseInt(String(sp.grade), 10) : undefined;
  const grade =
    gradeParam && gradeParam >= 6 && gradeParam <= 11 ? gradeParam : undefined;
  const classSection = sp.classSection ? String(sp.classSection) : undefined;
  const search = sp.search ? String(sp.search) : undefined;
  const sortRaw = String(sp.sort ?? "name");
  const sort = (SORT_ALLOWLIST as readonly string[]).includes(sortRaw)
    ? sortRaw
    : "name";
  const order = sp.order === "desc" ? "desc" : "asc";

  // Build Prisma where
  const where: Record<string, unknown> = { isDeleted: false };

  if (grade !== undefined) {
    where.class = { ...((where.class as object) ?? {}), grade };
  }
  if (classSection) {
    where.class = { ...((where.class as object) ?? {}), section: classSection };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { indexNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  // Build orderBy
  let orderBy: Record<string, unknown>;
  if (sort === "grade") {
    orderBy = { class: { grade: order } };
  } else {
    orderBy = { [sort]: order };
  }

  const skip = (page - 1) * limit;

  const [students, totalCount] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { class: true },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  // Serialize for client components
  const data = JSON.parse(JSON.stringify(students));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            Manage student records and profiles
          </p>
        </div>
        {canAddEdit && (
          <Link
            href="/dashboard/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </Link>
        )}
      </div>

      <StudentFilterBar />

      <StudentTable
        data={data}
        sort={sort}
        order={order}
        role={session.user.role as Role}
        canAddEdit={canAddEdit}
        canDelete={canDelete}
      />

      <PaginationControl
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
      />
    </div>
  );
}
