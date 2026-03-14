"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { GraduationCap } from "lucide-react";
import { NavItem } from "@/types/navigation";
import { resolveIcon } from "@/lib/icon-map";

interface MobileNavProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
  schoolLogoUrl?: string;
}

export default function MobileNav({ navItems, isOpen, onClose, schoolName, schoolLogoUrl }: MobileNavProps) {
  const pathname = usePathname();

  const mainItems = navItems.filter((item) => item.group === "main");
  const adminItems = navItems.filter((item) => item.group === "admin");

  // Most-specific match wins - prevents parent routes from lighting up
  const activeHref = navItems.reduce((best, item) => {
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-center px-4" title={schoolName || "SchoolMS"}>
            {schoolLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={schoolLogoUrl}
                alt="School logo"
                className="h-9 w-9 rounded-lg object-contain"
              />
            ) : (
              <GraduationCap className="h-8 w-8 text-primary" />
            )}
          </div>
          <Separator />
          <nav className="flex-1 overflow-y-auto space-y-1 px-2 py-3">
          {mainItems.map((item) => {
            const Icon = resolveIcon(item.icon);
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
                    onClick={onClose}
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
      </SheetContent>
    </Sheet>
  );
}
