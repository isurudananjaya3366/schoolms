/**
 * Notification helper — call this from any API route to emit an in-app
 * notification to the appropriate roles.
 *
 * Failures are silently swallowed via .catch(console.error) so that the
 * main API operation is never blocked by a notification write.
 */

import prisma from "@/lib/prisma";

/** Roles that can receive in-app notifications (STUDENT excluded per spec). */
export type NotifiableRole = "SUPERADMIN" | "ADMIN" | "STAFF" | "TEACHER";

/** Predefined notification type constants. */
export const NOTIF = {
  // Student events
  STUDENT_CREATED: "STUDENT_CREATED",
  STUDENT_UPDATED: "STUDENT_UPDATED",
  STUDENT_DELETED: "STUDENT_DELETED",

  // Mark events
  MARK_UPDATED: "MARK_UPDATED",

  // Meeting events
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  MEETING_UPDATED: "MEETING_UPDATED",
  MEETING_CANCELLED: "MEETING_CANCELLED",

  // User management events
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_REACTIVATED: "USER_REACTIVATED",

  // Backup & restore events
  BACKUP_TRIGGERED: "BACKUP_TRIGGERED",
  BACKUP_COMPLETED: "BACKUP_COMPLETED",
  BACKUP_FAILED: "BACKUP_FAILED",
  BACKUP_DELETED: "BACKUP_DELETED",
  RESTORE_TRIGGERED: "RESTORE_TRIGGERED",
  RESTORE_COMPLETED: "RESTORE_COMPLETED",
  RESTORE_FAILED: "RESTORE_FAILED",

  // Settings events
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
} as const;

export type NotifType = (typeof NOTIF)[keyof typeof NOTIF];

/** Role-to-notification-type mapping — defines which roles receive each type. */
export const NOTIF_TARGETS: Record<NotifType, NotifiableRole[]> = {
  // Student events
  STUDENT_CREATED: ["SUPERADMIN", "ADMIN", "STAFF"],
  STUDENT_UPDATED: ["SUPERADMIN", "ADMIN"],
  STUDENT_DELETED: ["SUPERADMIN", "ADMIN", "STAFF"],

  // Mark events
  MARK_UPDATED: ["SUPERADMIN", "ADMIN", "STAFF", "TEACHER"],

  // Meeting events — all staff roles
  MEETING_SCHEDULED: ["SUPERADMIN", "ADMIN", "STAFF", "TEACHER"],
  MEETING_UPDATED: ["SUPERADMIN", "ADMIN", "STAFF", "TEACHER"],
  MEETING_CANCELLED: ["SUPERADMIN", "ADMIN", "STAFF", "TEACHER"],

  // User management — admin-tier only
  USER_CREATED: ["SUPERADMIN", "ADMIN"],
  USER_UPDATED: ["SUPERADMIN", "ADMIN"],
  USER_DELETED: ["SUPERADMIN", "ADMIN"],
  USER_DEACTIVATED: ["SUPERADMIN", "ADMIN"],
  USER_REACTIVATED: ["SUPERADMIN", "ADMIN"],

  // Backup & restore — SUPERADMIN only (critical system events)
  BACKUP_TRIGGERED: ["SUPERADMIN"],
  BACKUP_COMPLETED: ["SUPERADMIN"],
  BACKUP_FAILED: ["SUPERADMIN"],
  BACKUP_DELETED: ["SUPERADMIN"],
  RESTORE_TRIGGERED: ["SUPERADMIN"],
  RESTORE_COMPLETED: ["SUPERADMIN"],
  RESTORE_FAILED: ["SUPERADMIN"],

  // Settings — admin-tier
  SETTINGS_UPDATED: ["SUPERADMIN", "ADMIN"],
};

export interface CreateNotificationOptions {
  type: NotifType;
  title: string;
  message: string;
  /** Override default targetRoles from NOTIF_TARGETS (optional). */
  targetRoles?: NotifiableRole[];
  /** Extra contextual data stored as JSON (e.g. { studentId, studentName }). */
  data?: Record<string, unknown>;
  /** Display name of the actor who triggered this (optional). */
  createdBy?: string;
}

/**
 * Emit an in-app notification. This is fire-and-forget — failures are logged
 * to console but never propagate to the calling API route.
 */
export function createNotification(opts: CreateNotificationOptions): void {
  const roles = opts.targetRoles ?? NOTIF_TARGETS[opts.type];

  prisma.notification
    .create({
      data: {
        type: opts.type,
        title: opts.title,
        message: opts.message,
        targetRoles: roles,
        data: opts.data ? (opts.data as import("@prisma/client").Prisma.InputJsonValue) : null,
        createdBy: opts.createdBy ?? null,
        readBy: [],
      },
    })
    .catch((err) => console.error("[notifications] Failed to create:", err));
}
