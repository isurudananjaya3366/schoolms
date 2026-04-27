import SidebarNav from "./SidebarNav";
import { NavItem } from "@/types/navigation";

interface SidebarProps {
  items: NavItem[];
  schoolName?: string;
  schoolLogoUrl?: string;
}

export default function Sidebar({ items, schoolName, schoolLogoUrl }: SidebarProps) {
  return (
    <aside className="hidden w-64 border-r bg-muted/40 lg:block sticky top-0 h-screen overflow-y-auto">
      <SidebarNav items={items} schoolName={schoolName} schoolLogoUrl={schoolLogoUrl} />
    </aside>
  );
}
