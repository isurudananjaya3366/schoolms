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
  UserCheck,
  ScrollText,
  Trophy,
  Presentation,
  CalendarDays,
  Bell,
  Megaphone,
  KeyRound,
  HelpCircle,
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
  UserCheck,
  ScrollText,
  Trophy,
  Presentation,
  CalendarDays,
  Bell,
  Megaphone,
  KeyRound,
  HelpCircle,
};

export function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? LayoutDashboard;
}
