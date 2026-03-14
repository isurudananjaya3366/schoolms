import {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  ClipboardList,
  Eye,
  FileBarChart,
  BarChart3,
  HardDriveDownload,
  Settings,
  UserCog,
  ScrollText,
  Trophy,
  Presentation,
  CalendarDays,
  Bell,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  ClipboardList,
  Eye,
  FileBarChart,
  BarChart3,
  HardDriveDownload,
  Settings,
  UserCog,
  ScrollText,
  Trophy,
  Presentation,
  CalendarDays,
  Bell,
  Megaphone,
};

export function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? LayoutDashboard;
}
