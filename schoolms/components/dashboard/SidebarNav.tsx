"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem } from "@/types/navigation";
import { Separator } from "@/components/ui/separator";
import { GraduationCap } from "lucide-react";
import { resolveIcon } from "@/lib/icon-map";

interface SidebarNavProps {
  items: NavItem[];
}

export default function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  const mainItems = items.filter((item) => item.group === "main");
  const adminItems = items.filter((item) => item.group === "admin");

  // Find the most specific nav item that matches the current path.
  // This prevents parent paths (e.g. /dashboard/marks) from being highlighted
  // when a child path (e.g. /dashboard/marks/entry) is active.
  const activeHref = items.reduce((best, item) => {
    const { href } = item;
    if (href === "/dashboard") {
      return pathname === "/dashboard" && href.length > best.length ? href : best;
    }
    if (pathname === href || pathname.startsWith(href + "/")) {
      return href.length > best.length ? href : best;
    }
    return best;
  }, "");

  function isActive(href: string) {
    return href === activeHref;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <GraduationCap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">SchoolMS</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-2 py-3">
        {mainItems.map((item) => {
          const Icon = resolveIcon(item.icon);
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {adminItems.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
              Administration
            </p>
            {adminItems.map((item) => {
              const Icon = resolveIcon(item.icon);
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}
