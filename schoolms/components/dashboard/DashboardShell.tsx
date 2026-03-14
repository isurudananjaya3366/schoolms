"use client";

import { useState, useRef, type ReactNode } from "react";
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
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentY = e.currentTarget.scrollTop;
    const diff = currentY - lastScrollY.current;
    if (Math.abs(diff) > 4) {
      setHeaderVisible(diff <= 0 || currentY < 56);
      lastScrollY.current = currentY;
    }
  };

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-30 transition-transform duration-300 lg:static lg:z-auto lg:translate-y-0 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Topbar
          role={role}
          displayName={displayName}
          onMenuClick={() => setIsMobileOpen(true)}
        />
      </div>
      <MobileNav
        navItems={filteredNavItems}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
      <main
        className="flex-1 overflow-y-auto p-4 pt-[calc(3.5rem+1rem)] lg:p-6"
        onScroll={handleMainScroll}
      >
        {children}
      </main>
    </>
  );
}
