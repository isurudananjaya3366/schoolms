import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { NavItem } from "@/types/navigation";
import { getRolePermissions } from "@/lib/permissions";

const ALL_NAV_ITEMS: (NavItem & { permKey?: string })[] = [
  { label: "Overview", href: "/dashboard", icon: "LayoutDashboard", minRole: "ALL", group: "main" },
  { label: "Students", href: "/dashboard/students", icon: "Users", minRole: "ALL", group: "main", permKey: "view_students" },
  { label: "Mark Entry", href: "/dashboard/marks/entry", icon: "ClipboardEdit", minRole: "ALL", group: "main", permKey: "edit_marks" },
  { label: "View Marks", href: "/dashboard/marks/view", icon: "Eye", minRole: "ALL", group: "main", permKey: "view_marks" },
  { label: "Student Reports", href: "/dashboard/student-reports", icon: "FileBarChart", minRole: "ALL", group: "main", permKey: "view_student_reports" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "BarChart3", minRole: "ALL", group: "main", permKey: "view_analytics" },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: "Trophy", minRole: "ALL", group: "main", permKey: "view_leaderboard" },
  { label: "Presentation Preview", href: "/dashboard/preview", icon: "Presentation", minRole: "ADMIN", group: "main" },
  { label: "Meeting Calendar", href: "/dashboard/calendar", icon: "CalendarDays", minRole: "ADMIN", group: "main" },
  { label: "Backup", href: "/dashboard/backup", icon: "HardDriveDownload", minRole: "SUPERADMIN", group: "admin", permKey: "view_backup" },
  { label: "Settings", href: "/dashboard/settings", icon: "Settings", minRole: "ADMIN", group: "admin" },
  { label: "Users", href: "/dashboard/settings/users", icon: "UserCog", minRole: "ADMIN", group: "admin" },
  { label: "Audit Log", href: "/dashboard/settings/audit", icon: "ScrollText", minRole: "SUPERADMIN", group: "admin" },
];

const ROLE_PRIORITY: Record<string, number> = {
  STAFF: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
  TEACHER: 1,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { role, name } = session.user;

  // Load permissions once for the layout
  const perms = await getRolePermissions(role);
  const userPriority = ROLE_PRIORITY[role] ?? 0;

  const filteredItems: NavItem[] = ALL_NAV_ITEMS.filter((item) => {
    // Hard minimum-role check
    if (item.minRole !== "ALL") {
      const itemPriority = ROLE_PRIORITY[item.minRole] ?? 999;
      if (userPriority < itemPriority) return false;
    }
    // Permission key check (skip if no permKey — always show those nav items)
    if (item.permKey) {
      return perms[item.permKey as keyof typeof perms] === true;
    }
    return true;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar items={filteredItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardShell
          role={role}
          displayName={name}
          filteredNavItems={filteredItems}
        >
          {children}
        </DashboardShell>
      </div>
    </div>
  );
}
