"use client";

import { useState, type ReactNode } from "react";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";
import { NavItem } from "@/types/navigation";

interface DashboardShellProps {
  role: string;
  displayName: string;
  filteredNavItems: NavItem[];
  children: ReactNode;
}

export default function DashboardShell({ role, displayName, filteredNavItems, children }: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      <Topbar
        role={role}
        displayName={displayName}
        onMenuClick={() => setIsMobileOpen(true)}
      />
      <MobileNav
        navItems={filteredNavItems}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </>
  );
}
