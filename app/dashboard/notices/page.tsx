import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ManageNoticesClient from "@/components/notices/ManageNoticesClient";

export const metadata = {
  title: "Manage Notices - SchoolMS",
};

const ROLE_PRIORITY: Record<string, number> = {
  STAFF: 1,
  TEACHER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export default async function ManageNoticesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const priority = ROLE_PRIORITY[session.user.role] ?? 0;
  if (priority < 2) {
    // STAFF and TEACHER cannot manage notices
    redirect("/dashboard");
  }

  return <ManageNoticesClient />;
}
