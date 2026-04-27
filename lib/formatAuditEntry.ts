import { AuditLog } from "@prisma/client";

export function formatAuditEntry(entry: AuditLog): string {
  const name = entry.userDisplayName;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(entry.details);
  } catch {
    // empty
  }

  switch (entry.action) {
    case "STUDENT_CREATED":
      return `${name} enrolled ${(parsed.targetName as string) || "a student"}`;
    case "STUDENT_UPDATED": {
      const fields = (parsed.fields as string[]) || (parsed.changedFields as string[]) || [];
      if (fields.length <= 3) return `${name} updated ${fields.join(", ")} for a student`;
      return `${name} updated ${fields.slice(0, 2).join(", ")} and ${fields.length - 2} others for a student`;
    }
    case "STUDENT_DELETED":
      return `${name} removed ${(parsed.studentName as string) || (parsed.targetName as string) || "a student"}`;
    case "USER_CREATED":
      return `${name} created account for ${(parsed.targetEmail as string) || "a user"} (${(parsed.role as string) || "STAFF"})`;
    case "USER_UPDATED":
      return `${name} updated user ${(parsed.targetEmail as string) || ""}`;
    case "USER_DEACTIVATED":
      return `${name} deactivated ${(parsed.targetEmail as string) || "a user"}`;
    case "USER_REACTIVATED":
      return `${name} reactivated ${(parsed.targetEmail as string) || "a user"}`;
    case "SETTINGS_UPDATED":
      return `${name} updated system settings`;
    case "MARK_UPDATED":
      return `${name} updated marks for ${(parsed.subject as string) || "a subject"} in ${(parsed.className as string) || "a class"}`;
    default:
      return `${name} performed an action`;
  }
}
