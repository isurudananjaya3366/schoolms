# Student Data Mutation: Design Proposals

## Executive Summary

This document addresses two critical design gaps in the SchoolMS data model:

1. **Elective Subject Changes** — A student switches elected subjects (e.g., Tamil → Accounting in Category I) between terms/years.
2. **Class Transfers** — A student moves from one class to another (e.g., 11B → 11D) between terms/years.

Both scenarios threaten the **immutability of historical records**, which is a core requirement for any academic records system.

---

## Current Data Model Overview

```
Student
  ├── id
  ├── classId          → current ClassGroup
  ├── electives
  │     ├── categoryI   (e.g., "Tamil")
  │     ├── categoryII  (e.g., "Art")
  │     └── categoryIII (e.g., "ICT")
  └── markRecords[]

MarkRecord
  ├── id
  ├── studentId
  ├── term             (TERM_1 | TERM_2 | TERM_3)
  ├── year             (e.g., 2024)
  └── marks
        ├── categoryI   (stores the numeric mark only — NOT the subject name)
        ├── categoryII
        └── categoryIII (+ core subjects)
```

**The Problem:** Both `Student.electives` and `Student.classId` are mutable single values. Historical `MarkRecord` entries do not capture *which subjects* or *which class* they belonged to at the time of entry. Any mutation to the Student record retroactively corrupts all historical report generation.

---

## Problem 1 — Elective Subject Changes

### How the Bug Manifests

When generating a student's progress report for Term 1, 2023:
1. System reads `student.electives.categoryI = "Accounting"` ← **current value**
2. System reads `markRecord.marks.categoryI = 85` ← **historical mark**
3. Report shows: `Accounting: 85`

But the student was taking **Tamil** in Term 1, 2023. The report is now **incorrect**.

### Proposed Solution: Elective Snapshot in MarkRecord

Add an **immutable snapshot** of the student's elected subjects to each `MarkRecord` at the time of creation/update.

#### Schema Change

```prisma
type ElectivesSnapshot {
  categoryI   String
  categoryII  String
  categoryIII String
}

model MarkRecord {
  // ... existing fields ...

  electivesSnapshot  ElectivesSnapshot?   // captured at save time
}
```

#### Behavior

| When | Action |
|------|--------|
| Creating a new `MarkRecord` | Automatically copy `student.electives` into `electivesSnapshot` |
| Updating an existing `MarkRecord` | Do **NOT** update `electivesSnapshot` — it is frozen once set |
| Generating a report for Term X, Year Y | Use `markRecord.electivesSnapshot` (if exists) to name the categories |
| Generating a report for legacy records (no snapshot) | Fall back to current `student.electives` (backward-compatible) |

#### API Impact

All `MarkRecord` creation/update handlers must be updated to include the snapshot:

```typescript
// In the marks entry POST/PUT handler:
const student = await prisma.student.findUnique({
  where: { id: studentId },
  select: { electives: true }
});

await prisma.markRecord.upsert({
  // ...
  create: {
    // ...
    electivesSnapshot: student.electives,
  },
  update: {
    marks: updatedMarks,
    // electivesSnapshot is NOT re-written on update
  }
});
```

#### Migration for Existing Records

For existing `MarkRecord` documents that lack `electivesSnapshot`:
- A one-time migration script can backfill them by joining `student.electives` on each record's `studentId`.
- This backfill is an approximation (uses current electives, not historical), but is acceptable for records created before this feature was added — it represents the "best available" data.

---

## Problem 2 — Class Transfers

### How the Bug Manifests

**Scenario:** Student X was in class 11B in 2023 but transferred to 11D in 2024.

- `Student.classId` is updated to point to 11D.
- Class reports for **11B, 2023** no longer include Student X (because query filters by `student.classId == 11B_id`, which is now 11D's ID).
- Class reports for **11D, 2023** would **wrongly include** Student X's 2023 records.

### Proposed Solution: Class Snapshot in MarkRecord

Add a `classIdSnapshot` to each `MarkRecord` capturing the class at the time of entry.

#### Schema Change

```prisma
model MarkRecord {
  // ... existing fields ...

  classIdSnapshot  String?  @db.ObjectId  // classId captured at save time
}
```

#### Behavior

| When | Action |
|------|--------|
| Creating a new `MarkRecord` | Copy `student.classId` → `classIdSnapshot` |
| Class reports | Filter by `classIdSnapshot == targetClassId` instead of `student.classId` |
| Student profile view | All mark records remain visible regardless of class changes |

#### Class Report API Change

All class-level mark report queries must use `classIdSnapshot`:

```typescript
// Instead of:
const records = await prisma.student.findMany({
  where: { classId: targetClassId, isDeleted: false },
  include: { markRecords: { where: { term, year } } }
});

// Use:
const records = await prisma.markRecord.findMany({
  where: {
    classIdSnapshot: targetClassId,
    term,
    year,
  },
  include: { student: true }
});
```

#### Migration for Existing Records

- Backfill `classIdSnapshot` from `student.classId` at migration time.
- This is accurate for all records where the student has **not yet** changed class — which covers all existing data before this feature is implemented.

---

## Combined Implementation Plan

### Phase A: Schema Update (Non-breaking)

1. Add `ElectivesSnapshot` composite type to `prisma/schema.prisma`.
2. Add `electivesSnapshot ElectivesSnapshot?` to `MarkRecord` (optional, so existing records are unaffected).
3. Add `classIdSnapshot String? @db.ObjectId` to `MarkRecord` (optional).
4. Run `prisma generate`.

### Phase B: API Update

Update these endpoints to write snapshots on create:

| Endpoint | Change |
|----------|--------|
| `POST /api/marks` (create mark entry) | Include `electivesSnapshot` + `classIdSnapshot` |
| `PUT /api/marks/[id]` (update marks) | Update `classIdSnapshot` only if not yet set; never update `electivesSnapshot` |

### Phase C: Report Generation Update

Update all report generation logic to prefer snapshots:

- `electivesSnapshot?.categoryI ?? student.electives.categoryI`
- Queries that previously filtered `student.classId == X` must instead filter `markRecord.classIdSnapshot == X`

### Phase D: Migration Script

Create a one-time migration script at `scripts/migrate-mark-snapshots.ts`:
- For each `MarkRecord` without `electivesSnapshot`: fetch `student.electives` and write it.
- For each `MarkRecord` without `classIdSnapshot`: fetch `student.classId` and write it.

---

## Design Principles Applied

| Principle | Applied To |
|-----------|------------|
| **Immutability of academic records** | `electivesSnapshot` is never overwritten after creation |
| **Backward compatibility** | All new fields are optional; existing records work with fallback logic |
| **Historical accuracy** | Reports for past terms/years use snapshot data, not current state |
| **Non-destructive updates** | Student class/elective changes only affect future records |

---

## Summary Table

| Scenario | Root Cause | Solution |
|----------|-----------|----------|
| Student changes elective (Tamil → Accounting) | `Student.electives` is a single mutable JSON | Snapshot `electives` into `MarkRecord.electivesSnapshot` at save time |
| Student changes class (11B → 11D) | `Student.classId` is a single FK | Snapshot `classId` into `MarkRecord.classIdSnapshot` at save time |
| Historical report shows wrong subject name | Report generation uses current state | Prefer `electivesSnapshot` over live `student.electives` |
| Class report includes wrong students | Class query uses current `student.classId` | Filter class reports on `classIdSnapshot` |

---

## Next Steps

1. **Review and approval** of this design by the project lead.
2. **Implement Phase A** (schema changes) — low risk, non-breaking.
3. **Implement Phase B + C** (API + report changes) — moderate effort.
4. **Run Phase D migration** once Phase C is deployed, to backfill existing data.
5. **Validate** that historical reports for past terms are now stable even after elective/class changes.

---

*Document created as part of the SchoolMS architecture discussion.*
*Last updated: 2025*
