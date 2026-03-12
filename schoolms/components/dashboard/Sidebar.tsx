import SidebarNav from "./SidebarNav";
import { NavItem } from "@/types/navigation";

interface SidebarProps {
  items: NavItem[];
}

export default function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="hidden w-64 border-r bg-muted/40 lg:block sticky top-0 h-screen overflow-y-auto">
      <SidebarNav items={items} />
    </aside>
  );
}
