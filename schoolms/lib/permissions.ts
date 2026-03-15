/**
 * Role-Permission System for SchoolMS
 *
 * Permissions are stored in SystemConfig as key "role_permissions" (JSON).
 * SUPERADMIN always has all permissions.
 * STUDENT has no dashboard permissions.
 *
 * Configurable roles: ADMIN, STAFF, TEACHER
 */

import prisma from "./prisma";

// ─── Permission Feature Definitions ─────────────────────────────────────────

export const PERMISSION_FEATURES = {
  view_students: {
    label: "View Students",
    description: "Access the student list and profiles",
    group: "Students",
  },
  add_edit_students: {
    label: "Add / Edit Students",
    description: "Create and update student profiles",
    group: "Students",
  },
  delete_students: {
    label: "Delete Students",
    description: "Permanently remove student records",
    group: "Students",
  },
  view_marks: {
    label: "View Marks",
    description: "Browse and filter mark records",
    group: "Marks",
  },
  edit_marks: {
    label: "Enter / Edit Marks",
    description: "Create and update mark records",
    group: "Marks",
  },
  view_student_reports: {
    label: "Student Reports",
    description: "Generate and download PDF progress reports",
    group: "Reports",
  },
  view_analytics: {
    label: "Analytics",
    description: "Access the analytics and charts dashboard",
    group: "Analytics & Rankings",
  },
  view_leaderboard: {
    label: "Leaderboard",
    description: "View student performance rankings",
    group: "Analytics & Rankings",
  },
  view_backup: {
    label: "Backup Dashboard",
    description: "View and manage database backups",
    group: "Administration",
  },
  view_audit_log: {
    label: "Audit Log",
    description: "View the system-wide audit trail",
    group: "Administration",
  },
  manage_users: {
    label: "Manage Users",
    description: "Create, edit, and deactivate user accounts",
    group: "Administration",
  },
  view_notices: {
    label: "Manage Notices",
    description: "Create, edit, and delete school notices",
    group: "Content & Communication",
  },
  view_notifications: {
    label: "Notifications",
    description: "View system notifications",
    group: "Content & Communication",
  },
  view_calendar: {
    label: "Calendar",
    description: "Access the school calendar",
    group: "General",
  },
  view_preview: {
    label: "Preview Mode",
    description: "Use the classroom presentation / preview mode",
    group: "General",
  },
  assign_teachers: {
    label: "Assign Teachers",
    description: "Assign teacher users to class groups",
    group: "Administration",
  },
} as const;

export type PermissionKey = keyof typeof PERMISSION_FEATURES;

// Configurable roles - SUPERADMIN is always full-access, STUDENT has no dash access
export const CONFIGURABLE_ROLES = ["ADMIN", "STAFF", "TEACHER"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export type RolePermissions = Record<PermissionKey, boolean>;
export type AllRolePermissions = Record<ConfigurableRole, RolePermissions>;

// ─── Default Permissions ──────────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: AllRolePermissions = {
  ADMIN: {
    view_students: true,
    add_edit_students: true,
    delete_students: true,
    view_marks: true,
    edit_marks: true,
    view_student_reports: true,
    view_analytics: true,
    view_leaderboard: true,
    view_backup: false,
    view_audit_log: true,
    manage_users: true,
    view_notices: true,
    view_notifications: true,
    view_calendar: true,
    view_preview: true,
    assign_teachers: true,
  },
  STAFF: {
    view_students: true,
    add_edit_students: true,
    delete_students: false,
    view_marks: true,
    edit_marks: true,
    view_student_reports: true,
    view_analytics: false,
    view_leaderboard: false,
    view_backup: false,
    view_audit_log: false,
    manage_users: false,
    view_notices: true,
    view_notifications: true,
    view_calendar: true,
    view_preview: true,
    assign_teachers: false,
  },
  TEACHER: {
    view_students: true,
    add_edit_students: false,
    delete_students: false,
    view_marks: true,
    edit_marks: true,
    view_student_reports: false,
    view_analytics: false,
    view_leaderboard: false,
    view_backup: false,
    view_audit_log: false,
    manage_users: false,
    view_notices: true,
    view_notifications: true,
    view_calendar: true,
    view_preview: false,
    assign_teachers: false,
  },
};

// ─── Load Permissions (server-side) ───────────────────────────────────────────

/**
 * Load the stored permissions from SystemConfig, merged with defaults.
 * Fetches from DB every call - wrap in React `cache()` at call site if needed.
 */
export async function loadPermissions(): Promise<AllRolePermissions> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "role_permissions" },
    });
    if (config?.value) {
      const stored = JSON.parse(config.value) as Partial<AllRolePermissions>;
      // Deep merge with defaults so new features get their defaults
      const merged: AllRolePermissions = { ...DEFAULT_PERMISSIONS };
      for (const role of CONFIGURABLE_ROLES) {
        if (stored[role]) {
          merged[role] = { ...DEFAULT_PERMISSIONS[role], ...stored[role] };
        }
      }
      return merged;
    }
  } catch {
    // Parse error or DB error - fall back to defaults
  }
  return DEFAULT_PERMISSIONS;
}

/**
 * Check if a specific role has a permission.
 * SUPERADMIN always returns true.
 * STUDENT always returns false.
 */
export async function hasPermission(
  role: string,
  key: PermissionKey
): Promise<boolean> {
  if (role === "SUPERADMIN") return true;
  if (role === "STUDENT") return false;
  if (!CONFIGURABLE_ROLES.includes(role as ConfigurableRole)) return false;

  const perms = await loadPermissions();
  return perms[role as ConfigurableRole]?.[key] ?? false;
}

/**
 * Load all permissions for one role.
 * SUPERADMIN: all true. STUDENT: all false.
 */
export async function getRolePermissions(role: string): Promise<RolePermissions> {
  if (role === "SUPERADMIN") {
    return Object.fromEntries(
      Object.keys(PERMISSION_FEATURES).map((k) => [k, true])
    ) as RolePermissions;
  }
  if (role === "STUDENT") {
    return Object.fromEntries(
      Object.keys(PERMISSION_FEATURES).map((k) => [k, false])
    ) as RolePermissions;
  }
  const perms = await loadPermissions();
  return perms[role as ConfigurableRole] ?? DEFAULT_PERMISSIONS.STAFF;
}
