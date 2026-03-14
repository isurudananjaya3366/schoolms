/**
 * Seed script: create one user per role for testing.
 *
 * Usage:
 *   npx tsx scripts/seed-role-users.ts
 *
 * Skips SUPERADMIN (already exists).
 * Creates:
 *   ADMIN    - admin@schoolms.com     / Admin@123
 *   STAFF    - staff@schoolms.com     / Staff@123
 *   TEACHER  - teacher@schoolms.com   / Teacher@123  (assigned to class 10A)
 *   STUDENT  - (demo, linked to first student in DB)
 *              demo.student@schoolms.com / Student@123
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(data: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "STAFF" | "TEACHER" | "STUDENT";
  assignedClassId?: string;
  linkedStudentId?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    console.log(`⚠️  ${data.role} already exists (${data.email}), skipping.`);
    return existing;
  }
  const passwordHash = await hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      isActive: true,
      ...(data.assignedClassId ? { assignedClassId: data.assignedClassId } : {}),
      ...(data.linkedStudentId ? { linkedStudentId: data.linkedStudentId } : {}),
    },
  });
  console.log(`✅ ${data.role} created: ${data.email}`);
  return user;
}

async function main() {
  // ── ADMIN ──────────────────────────────────────────────────────
  await upsertUser({
    name: "Admin User",
    email: "admin@schoolms.com",
    password: "Admin@123",
    role: "ADMIN",
  });

  // ── STAFF ──────────────────────────────────────────────────────
  await upsertUser({
    name: "Staff User",
    email: "staff@schoolms.com",
    password: "Staff@123",
    role: "STAFF",
  });

  // ── TEACHER - assign to class 10A ──────────────────────────────
  const class10A = await prisma.classGroup.findFirst({
    where: { grade: 10, section: "A" },
  });
  if (!class10A) {
    console.error("❌ Class 10A not found. Run seed-large-dataset.ts first.");
    process.exit(1);
  }
  await upsertUser({
    name: "Teacher User",
    email: "teacher@schoolms.com",
    password: "Teacher@123",
    role: "TEACHER",
    assignedClassId: class10A.id,
  });

  // ── STUDENT - link to first student in DB ──────────────────────
  const firstStudent = await prisma.student.findFirst({
    where: { isDeleted: false },
    orderBy: { createdAt: "asc" },
  });
  if (!firstStudent) {
    console.error("❌ No students found. Run seed-large-dataset.ts first.");
    process.exit(1);
  }
  const studentUser = await upsertUser({
    name: firstStudent.name,
    email: "demo.student@schoolms.com",
    password: "Student@123",
    role: "STUDENT",
    linkedStudentId: firstStudent.id,
  });

  console.log("\n📋 Summary:");
  console.log("─────────────────────────────────────────────────");
  console.log(`  SUPERADMIN : superadmin@schoolms.com  / SuperAdmin@123  (existing)`);
  console.log(`  ADMIN      : admin@schoolms.com       / Admin@123`);
  console.log(`  STAFF      : staff@schoolms.com       / Staff@123`);
  console.log(`  TEACHER    : teacher@schoolms.com     / Teacher@123  → Class 10A`);
  console.log(`  STUDENT    : demo.student@schoolms.com / Student@123  → "${firstStudent.name}" (${firstStudent.indexNumber ?? "no index"})`);
  console.log("─────────────────────────────────────────────────");
  console.log(`\n  Student linked: ${firstStudent.name} (ID: ${firstStudent.id})`);
  if (studentUser) console.log(`  Student user ID: ${studentUser.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding role users:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
