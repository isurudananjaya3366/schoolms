# SchoolMS - Test Credentials

> **Date seeded:** see script `scripts/seed-role-users.ts`
> All accounts are active and ready for testing.

---

## Admin / Staff Accounts (Login via `/login`)

| Role          | Email                         | Password        | Notes                        |
|---------------|-------------------------------|-----------------|------------------------------|
| SUPERADMIN    | superadmin@schoolms.com       | password123  | Full system access           |
| ADMIN         | admin@schoolms.com            | password123       | Can manage users/data        |
| STAFF         | staff@schoolms.com            | password123       | Limited management access    |
| TEACHER       | teacher@schoolms.com          | password123     | Assigned to class **10A**    |
| STUDENT (demo)| demo.student@schoolms.com     | password123     | Linked to *Sahan Silva* (STU0001) |

---

## Student Portal (No Login Required)

Students **do not need an account**. They access their profile via the public portal:

| URL                          | Description                              |
|------------------------------|------------------------------------------|
| `/student`                   | Search page - enter name or index number |
| `/student/view/STU0001`      | Direct profile view by index number      |

### How to test student lookup:

1. Go to `/student`
2. Type any of the following:
   - `STU0001` → exact index number → finds Sahan Silva immediately
   - `sahan` → fuzzy name match → finds Sahan Silva
   - `sahansilva` (no space) → normalized match → still finds correctly
   - `savindubandara` → finds Savindu Bandara (if seeded)
3. Click the result card to view the full profile with mark records by year and term.

---

## Role Capabilities Summary

| Role       | Dashboard | Users Mgmt | Students | Marks | Analytics | Config |
|------------|-----------|-----------|----------|-------|-----------|--------|
| SUPERADMIN | ✅        | ✅ (all)  | ✅       | ✅    | ✅        | ✅     |
| ADMIN      | ✅        | ✅ (STAFF/TEACHER/STUDENT) | ✅ | ✅ | ✅   | ❌     |
| STAFF      | ✅        | ❌        | ✅       | ✅    | ✅        | ❌     |
| TEACHER    | ✅        | ❌        | Limited  | Limited | ✅     | ❌     |
| STUDENT    | ❌ → `/student/profile` | ❌ | ❌ | ❌ | ❌  | ❌     |

---

## Student Index Numbers (sample for testing lookup)

```
STU0001  - Sahan Silva         (Class 10A)
STU0002  - ...                 (Class 10A)
...
```

> Full list: run `npx tsx scripts/seed-large-dataset.ts` output or check DB directly.
