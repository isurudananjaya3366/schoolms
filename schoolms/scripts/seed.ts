/**
 * Comprehensive seed script for SchoolMS.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * This script is idempotent — safe to run multiple times.
 * It performs the following:
 *   1. Creates SUPERADMIN user if none exists
 *   2. Seeds default SystemConfig (school name, academic year, core subjects, elective subjects)
 *   3. Seeds class groups (grades 6-11, sections A-F) if none exist
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// ─── Default values ───────────────────────────────────────────────

const SUPERADMIN_EMAIL = "superadmin@schoolms.com";
const SUPERADMIN_PASSWORD = "SuperAdmin@123";
const SUPERADMIN_NAME = "Super Admin";

const DEFAULT_CORE_SUBJECTS: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Mathematics",
  science: "Science",
  english: "English",
  history: "History",
};

const DEFAULT_ELECTIVE_I = [
  "Geography",
  "Civic Studies",
  "Accounting",
  "Tamil",
];

const DEFAULT_ELECTIVE_II = [
  "Art",
  "Dancing",
  "Music",
  "Drama & Theatre",
  "Sinhala Literature",
  "English Literature",
];

const DEFAULT_ELECTIVE_III = [
  "Health",
  "ICT",
  "Agriculture",
  "Art & Crafts",
  "Electrical & Electronic Tech.",
  "Construction Tech.",
];

const GRADES = [6, 7, 8, 9, 10, 11];
const SECTIONS = ["A", "B", "C", "D", "E", "F"];

// ─── 1. SUPERADMIN ───────────────────────────────────────────────

async function seedSuperAdmin() {
  console.log("\n━━━ 1. SUPERADMIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const existing = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });

  if (existing) {
    console.log(`  ✅ Already exists: ${existing.email}`);
    return;
  }

  const passwordHash = await hash(SUPERADMIN_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      name: SUPERADMIN_NAME,
      email: SUPERADMIN_EMAIL,
      passwordHash,
      role: "SUPERADMIN",
      isActive: true,
    },
  });

  console.log("  ✅ Created SUPERADMIN");
  console.log(`     Email:    ${SUPERADMIN_EMAIL}`);
  console.log(`     Password: ${SUPERADMIN_PASSWORD}`);
  console.log(`     ID:       ${user.id}`);
}

// ─── 2. System Config (subjects & settings) ─────────────────────

async function seedSystemConfig() {
  console.log("\n━━━ 2. SYSTEM CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const defaults: { key: string; value: string }[] = [
    { key: "school_name", value: "SchoolMS" },
    { key: "academic_year", value: new Date().getFullYear().toString() },
    {
      key: "core_subjects",
      value: JSON.stringify(DEFAULT_CORE_SUBJECTS),
    },
    {
      key: "elective_label_I",
      value: JSON.stringify(DEFAULT_ELECTIVE_I),
    },
    {
      key: "elective_label_II",
      value: JSON.stringify(DEFAULT_ELECTIVE_II),
    },
    {
      key: "elective_label_III",
      value: JSON.stringify(DEFAULT_ELECTIVE_III),
    },
    { key: "school_logo_url", value: "" },
  ];

  let created = 0;
  let skipped = 0;

  for (const { key, value } of defaults) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (existing) {
      console.log(`  ⏭️  ${key} — already set`);
      skipped++;
    } else {
      await prisma.systemConfig.create({ data: { key, value } });
      console.log(`  ✅ ${key} — created`);
      created++;
    }
  }

  console.log(`  Summary: ${created} created, ${skipped} skipped`);
}

// ─── 3. Class Groups ────────────────────────────────────────────

async function seedClassGroups() {
  console.log("\n━━━ 3. CLASS GROUPS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const existing = await prisma.classGroup.count();

  if (existing > 0) {
    console.log(`  ⏭️  ${existing} class groups already exist — skipping`);
    return;
  }

  const data: { grade: number; section: string }[] = [];
  for (const grade of GRADES) {
    for (const section of SECTIONS) {
      data.push({ grade, section });
    }
  }

  const result = await prisma.classGroup.createMany({ data });
  console.log(`  ✅ Created ${result.count} class groups (grades ${GRADES[0]}-${GRADES[GRADES.length - 1]}, sections ${SECTIONS[0]}-${SECTIONS[SECTIONS.length - 1]})`);
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║           SchoolMS — Database Seeder             ║");
  console.log("╚══════════════════════════════════════════════════╝");

  await seedSuperAdmin();
  await seedSystemConfig();
  await seedClassGroups();

  console.log("\n══════════════════════════════════════════════════");
  console.log("  🎉 Seeding complete!");
  console.log("══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
