import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { NavItem } from "@/types/navigation";

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "LayoutDashboard", minRole: "ALL", group: "main" },
  { label: "Students", href: "/dashboard/students", icon: "Users", minRole: "ALL", group: "main" },
  { label: "Mark Entry", href: "/dashboard/marks/entry", icon: "ClipboardEdit", minRole: "ALL", group: "main" },
  { label: "View Marks", href: "/dashboard/marks/view", icon: "Eye", minRole: "ALL", group: "main" },
  { label: "Reports", href: "/dashboard/reports", icon: "FileBarChart", minRole: "ALL", group: "main" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "BarChart3", minRole: "ADMIN", group: "main" },
  { label: "Backup", href: "/dashboard/backup", icon: "HardDriveDownload", minRole: "SUPERADMIN", group: "admin" },
  { label: "Settings", href: "/dashboard/settings", icon: "Settings", minRole: "ADMIN", group: "admin" },
  { label: "Users", href: "/dashboard/settings/users", icon: "UserCog", minRole: "ADMIN", group: "admin" },
  { label: "Audit Log", href: "/dashboard/settings/audit", icon: "ScrollText", minRole: "SUPERADMIN", group: "admin" },
];

const ROLE_PRIORITY: Record<string, number> = {
  STAFF: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

function filterNavByRole(role: string): NavItem[] {
  const userPriority = ROLE_PRIORITY[role] ?? 0;
  return navItems.filter((item) => {
    if (item.minRole === "ALL") return true;
    const itemPriority = ROLE_PRIORITY[item.minRole] ?? 999;
    return userPriority >= itemPriority;
  });
}

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
  const filteredItems = filterNavByRole(role);

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
