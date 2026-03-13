import {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  Eye,
  FileBarChart,
  BarChart3,
  HardDriveDownload,
  Settings,
  UserCog,
  ScrollText,
  Trophy,
  Presentation,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  Eye,
  FileBarChart,
  BarChart3,
  HardDriveDownload,
  Settings,
  UserCog,
  ScrollText,
  Trophy,
  Presentation,
};

export function resolveIcon(name: string): LucideIcon {
  return iconMap[name] ?? LayoutDashboard;
}
