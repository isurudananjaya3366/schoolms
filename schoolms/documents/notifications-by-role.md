# Role-Based Notification Reference

This document describes which in-app notifications each role receives in SchoolMS. Notification targeting is enforced by `lib/notifications.ts` via the `NOTIF_TARGETS` map.

> **Note:** `STUDENT` accounts receive **no** in-app notifications. A public notice board for students is planned for a future phase.

---

## Notification Channels

All notifications are stored in the `notifications` MongoDB collection and surfaced through:
- **Notification Bell** in the Topbar (shows unread count badge)
- **Notifications Page** at `/dashboard/notifications` (full list with filters)

---

## Role Matrix

| Notification Type | SUPERADMIN | ADMIN | STAFF | TEACHER |
|---|:---:|:---:|:---:|:---:|
| **Student Events** |  |  |  |  |
| New student added (`STUDENT_CREATED`) | ✅ | ✅ | ✅ | — |
| Student profile updated (`STUDENT_UPDATED`) | ✅ | ✅ | — | — |
| Student removed (`STUDENT_DELETED`) | ✅ | ✅ | ✅ | — |
| **Mark Events** |  |  |  |  |
| Marks updated (`MARK_UPDATED`) | ✅ | ✅ | ✅ | ✅ |
| **Meeting Events** |  |  |  |  |
| Meeting scheduled (`MEETING_SCHEDULED`) | ✅ | ✅ | ✅ | ✅ |
| Meeting updated (`MEETING_UPDATED`) | ✅ | ✅ | ✅ | ✅ |
| Meeting cancelled (`MEETING_CANCELLED`) | ✅ | ✅ | ✅ | ✅ |
| **User Management Events** |  |  |  |  |
| New user created (`USER_CREATED`) | ✅ | ✅ | — | — |
| User account updated (`USER_UPDATED`) | ✅ | ✅ | — | — |
| User deactivated (`USER_DEACTIVATED`) | ✅ | ✅ | — | — |
| User reactivated (`USER_REACTIVATED`) | ✅ | ✅ | — | — |
| User deleted (`USER_DELETED`) | ✅ | ✅ | — | — |
| **Backup & Restore Events** |  |  |  |  |
| Backup triggered (`BACKUP_TRIGGERED`) | ✅ | — | — | — |
| Backup completed (`BACKUP_COMPLETED`) | ✅ | — | — | — |
| Backup failed (`BACKUP_FAILED`) | ✅ | — | — | — |
| Backup file deleted (`BACKUP_DELETED`) | ✅ | — | — | — |
| Restore triggered (`RESTORE_TRIGGERED`) | ✅ | — | — | — |
| Restore completed (`RESTORE_COMPLETED`) | ✅ | — | — | — |
| Restore failed (`RESTORE_FAILED`) | ✅ | — | — | — |
| **System Events** |  |  |  |  |
| Settings updated (`SETTINGS_UPDATED`) | ✅ | ✅ | — | — |

---

## Role Summaries

### SUPERADMIN
Receives **all** notifications — every student, mark, meeting, user, backup/restore, and settings event. This role has full system visibility.

### ADMIN
Receives notifications for day-to-day school operations:
- All student events (added / updated / removed)
- All mark updates
- All meeting events (scheduled / updated / cancelled)
- User account changes (created / updated / deactivated / reactivated / deleted)
- Settings changes

Does **not** receive backup/restore system-level events (SUPERADMIN-only).

### STAFF
Receives notifications relevant to student administration:
- Student created and deleted (not updates)
- Mark updates
- All meeting events (scheduled / updated / cancelled)

Does **not** receive user management or backup events.

### TEACHER
Receives academically relevant notifications:
- Mark updates across the school
- All meeting events (scheduled / updated / cancelled)

Does **not** receive student profile changes, user management, or backup events.

---

## Triggering Points

Notifications are fired automatically by the following API routes:

| Route | Method | Notification Emitted |
|---|---|---|
| `/api/students` | POST | `STUDENT_CREATED` |
| `/api/students/[id]` | PATCH | `STUDENT_UPDATED` |
| `/api/students/[id]` | DELETE | `STUDENT_DELETED` |
| `/api/marks` | POST | `MARK_UPDATED` |
| `/api/meetings` | POST | `MEETING_SCHEDULED` |
| `/api/meetings/[id]` | PUT | `MEETING_UPDATED` |
| `/api/meetings/[id]` | DELETE | `MEETING_CANCELLED` |
| `/api/users` | POST | `USER_CREATED` |
| `/api/users/[id]` | PATCH | `USER_UPDATED` / `USER_DEACTIVATED` / `USER_REACTIVATED` |
| `/api/users/[id]` | DELETE | `USER_DELETED` |
| `/api/backup` | GET (cron) | `BACKUP_COMPLETED` / `BACKUP_FAILED` |
| `/api/backup` | POST (manual) | `BACKUP_COMPLETED` / `BACKUP_FAILED` |

---

## API Reference

### `GET /api/notifications`
Returns paginated notifications for the current user's role.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 50)
- `unread=true` — show only unread notifications

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "type": "STUDENT_CREATED",
      "title": "New Student Added",
      "message": "Admin added John Doe to Grade 11B.",
      "targetRoles": ["SUPERADMIN", "ADMIN", "STAFF"],
      "data": { "studentId": "...", "grade": 11, "section": "B" },
      "createdBy": "Admin Name",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "isRead": false
    }
  ],
  "unreadCount": 5,
  "pagination": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

### `POST /api/notifications/[id]/read`
Marks a single notification as read. Returns `{ "ok": true }`.

### `POST /api/notifications/read-all`
Marks all notifications for the current user's role as read. Returns `{ "markedRead": 12 }`.

---

## Implementation Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `Notification` model definition |
| `lib/notifications.ts` | `createNotification()` helper + `NOTIF_TARGETS` mapping |
| `app/api/notifications/route.ts` | GET — list + unread count |
| `app/api/notifications/[id]/read/route.ts` | POST — mark single as read |
| `app/api/notifications/read-all/route.ts` | POST — mark all as read |
| `app/dashboard/notifications/page.tsx` | Server page wrapper |
| `components/dashboard/notifications/NotificationsClient.tsx` | Full-page notifications UI |
| `components/dashboard/Topbar.tsx` | Bell icon with unread badge |
