export interface NavItem {
  label: string;
  href: string;
  minRole: "ALL" | "ADMIN" | "SUPERADMIN";
  icon: string;
  group: "main" | "admin";
}
