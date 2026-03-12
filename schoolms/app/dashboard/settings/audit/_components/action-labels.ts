export const ACTION_LABELS: Record<string, string> = {
  STUDENT_CREATED: "Student record created",
  STUDENT_UPDATED: "Student record updated",
  STUDENT_DELETED: "Student record deleted",
  USER_CREATED: "User account created",
  USER_UPDATED: "User account updated",
  USER_DEACTIVATED: "User account deactivated",
  USER_REACTIVATED: "User account reactivated",
  USER_DELETED: "User account deleted",
  SETTINGS_UPDATED: "Settings updated",
  MARK_UPDATED: "Mark entry updated",
  REPORT_VIEWED: "Report viewed",
  BACKUP_TRIGGERED: "Backup triggered",
  BACKUP_COMPLETED: "Backup completed",
  BACKUP_FAILED: "Backup failed",
  BACKUP_DELETED: "Backup deleted",
  RESTORE_TRIGGERED: "Restore triggered",
  RESTORE_COMPLETED: "Restore completed",
  RESTORE_FAILED: "Restore failed",
};

export const ALL_ACTION_TYPES = Object.keys(ACTION_LABELS);
