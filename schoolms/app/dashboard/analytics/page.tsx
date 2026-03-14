import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import AnalyticsContainer from "./AnalyticsContainer";

export const metadata = { title: "Analytics | SchoolMS" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Permission-based guard (respects SUPERADMIN override)
  const role = session.user.role as string;
  if (!(await hasPermission(role, "view_analytics"))) redirect("/dashboard");

  const params = await searchParams;

  // Extract initial filter values from URL
  const initialGrade =
    typeof params.grade === "string" ? params.grade : undefined;
  const initialSection =
    typeof params.section === "string" ? params.section : undefined;
  const initialTerm =
    typeof params.term === "string" ? params.term : undefined;
  const initialYear =
    typeof params.year === "string" ? params.year : undefined;

  // Server-side initial data fetch
  const apiUrl = new URL(
    "/api/analytics/summary",
    process.env.NEXTAUTH_URL || "http://localhost:3000"
  );
  if (initialGrade) apiUrl.searchParams.set("grade", initialGrade);
  if (initialSection) apiUrl.searchParams.set("section", initialSection);
  if (initialTerm) apiUrl.searchParams.set("term", initialTerm);
  if (initialYear) apiUrl.searchParams.set("year", initialYear);

  let initialData = null;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(apiUrl.toString(), {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch {
    // Server-side fetch failed - container will retry client-side
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Cohort-level performance insights across grades, terms, and subjects.
        </p>
      </div>
      <AnalyticsContainer
        initialData={initialData}
        initialFilters={{
          grade: initialGrade || "",
          section: initialSection || "",
          term: initialTerm || "",
          year: initialYear || String(new Date().getFullYear()),
        }}
      />
    </div>
  );
}
