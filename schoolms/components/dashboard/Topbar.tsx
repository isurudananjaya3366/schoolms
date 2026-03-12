"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, LogOut, Bell } from "lucide-react";

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  students: "Students",
  marks: "Marks",
  entry: "Entry",
  view: "View",
  reports: "Reports",
  analytics: "Analytics",
  backup: "Backup",
  settings: "Settings",
  users: "Users",
  audit: "Audit Log",
  new: "New",
  edit: "Edit",
  preview: "Preview",
};

interface TopbarProps {
  role: string;
  displayName: string;
  onMenuClick: () => void;
}

export default function Topbar({ role, displayName, onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const breadcrumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = breadcrumbLabels[seg] || seg;
    return { label, href, isLast: i === segments.length - 1 };
  });

  const roleBadgeVariant = role === "SUPERADMIN" ? "default" : role === "ADMIN" ? "secondary" : "outline";

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {crumb.isLast ? (
                <span className="font-medium">{crumb.label}</span>
              ) : (
                <a
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {crumb.label}
                </a>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Notifications — coming soon">
          <Bell className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="hidden text-sm sm:inline">{displayName}</span>
        <Badge variant={roleBadgeVariant}>{role}</Badge>
        <Button
          variant="ghost"
          size="icon"
          title="Sign out"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
