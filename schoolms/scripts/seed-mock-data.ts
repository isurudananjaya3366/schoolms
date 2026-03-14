/**
 * Mock data seeder for SchoolMS.
 *
 * Usage:
 *   npx tsx scripts/seed-mock-data.ts
 *
 * This script is idempotent - safe to run multiple times.
 * It populates the database with realistic Sri Lankan student
 * data and mark records for testing/demo purposes.
 *
 * Prerequisites:
 *   - Run `npx tsx scripts/seed.ts` first (creates SUPERADMIN,
 *     system config, and class groups).
 */

import { PrismaClient, Term } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Name pools ──────────────────────────────────────────────────

const MALE_NAMES = [
  "Kavindu Perera",
  "Sahan Silva",
  "Tharindu Fernando",
  "Dinesh Jayawardena",
  "Amila Bandara",
  "Nuwan Kumara",
  "Chaminda Rajapaksha",
  "Lasith Malinga",
  "Dhananjaya De Silva",
  "Kasun Weerasinghe",
  "Isuru Udana",
  "Thilan Samaraweera",
  "Lahiru Thirimanne",
  "Dimuth Karunaratne",
  "Charith Asalanka",
  "Kusal Mendis",
  "Pathum Nissanka",
  "Dasun Shanaka",
  "Dunith Wellalage",
  "Wanindu Hasaranga",
  "Asitha Fernando",
  "Maheesh Theekshana",
  "Shanaka Liyanage",
  "Minod Bhanuka",
  "Pramod Madushan",
  "Kamindu Mendis",
  "Sandun Weerakkody",
  "Lakshan Gamage",
  "Chamara Nethmina",
  "Pawan Rathnayake",
];

const FEMALE_NAMES = [
  "Nethmi Senaratne",
  "Saduni Ratnayake",
  "Ishani De Silva",
  "Malsha Wickramasinghe",
  "Sewmini Kumarasinghe",
  "Tharushi Jayasuriya",
  "Dinusha Herath",
  "Kavisha Dilhara",
  "Hansani Weerasooriya",
  "Sanumi Liyanage",
  "Nimasha Priyangika",
  "Poorna Kavindya",
  "Sachini Perera",
  "Dulani Kumari",
  "Imesha Madushani",
  "Nilmini Thilakarathne",
  "Pavithra Wanniarachchi",
  "Hiruni Samaratunga",
  "Yashoda Pathirana",
  "Senali Gunawardena",
];

// All 50 names combined (30 male + 20 female)
const ALL_NAMES = [...MALE_NAMES, ...FEMALE_NAMES];

// ─── Elective subject pools ──────────────────────────────────────

const ELECTIVE_I = ["Geography", "Civic Studies", "Accounting", "Tamil"];

const ELECTIVE_II = [
  "Art",
  "Dancing",
  "Music",
  "Drama & Theatre",
  "Sinhala Literature",
  "English Literature",
];

const ELECTIVE_III = [
  "Health",
  "ICT",
  "Agriculture",
  "Art & Crafts",
  "Electrical & Electronic Tech.",
  "Construction Tech.",
];

// ─── Constants ───────────────────────────────────────────────────

const YEARS = [2023, 2024, 2025, 2026];
const TERMS: Term[] = ["TERM_1", "TERM_2", "TERM_3"];
const FIRST_INDEX = 3; // STU003 onwards (STU001/002 already exist)

// ─── Helpers ─────────────────────────────────────────────────────

/** Random integer between min and max (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Format an index number like "STU003". */
function formatIndex(n: number): string {
  return `STU${String(n).padStart(3, "0")}`;
}

/**
 * Generate a single mark value based on the student's profile.
 *
 * @param profile - "high" | "average" | "low"
 * @returns a mark (0-100) or null (~8% chance for nulls)
 */
function generateMark(
  profile: "high" | "average" | "low"
): number | null {
  // ~8% chance the mark is null (student didn't sit for this subject)
  if (Math.random() < 0.08) return null;

  switch (profile) {
    case "high":
      return randInt(70, 98);
    case "low":
      // mostly 15-45 but allow a few even lower (W-grade territory)
      return Math.random() < 0.3 ? randInt(5, 34) : randInt(15, 45);
    case "average":
    default:
      // bulk: 40-90 with occasional outliers
      return Math.random() < 0.1 ? randInt(20, 39) : randInt(40, 90);
  }
}

/** Assign a performance profile to a student index (deterministic). */
function getProfile(i: number): "high" | "average" | "low" {
  // ~20% high achievers, ~20% low performers, ~60% average
  if (i % 5 === 0) return "high";
  if (i % 5 === 1) return "low";
  return "average";
}

/**
 * Generate a full Marks object for a student.
 */
function generateMarks(profile: "high" | "average" | "low") {
  return {
    sinhala: generateMark(profile),
    buddhism: generateMark(profile),
    maths: generateMark(profile),
    science: generateMark(profile),
    english: generateMark(profile),
    history: generateMark(profile),
    categoryI: generateMark(profile),
    categoryII: generateMark(profile),
    categoryIII: generateMark(profile),
  };
}

// ─── Seed logic ──────────────────────────────────────────────────

async function seedMockStudents() {
  console.log("\n━━━ 1. PRE-FLIGHT CHECKS ━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Check idempotency - if STU003 already exists, skip everything
  const sentinel = await prisma.student.findFirst({
    where: { indexNumber: formatIndex(FIRST_INDEX) },
  });

  if (sentinel) {
    console.log(
      `  ⏭️  Mock students already seeded (found ${formatIndex(FIRST_INDEX)}) - skipping`
    );
    return;
  }

  // Look up class groups
  const classGroups = await prisma.classGroup.findMany({
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });

  if (classGroups.length === 0) {
    console.error(
      "  ❌ No class groups found. Run `npx tsx scripts/seed.ts` first."
    );
    process.exit(1);
  }
  console.log(`  ✅ Found ${classGroups.length} class groups`);

  // Look up SUPERADMIN for updatedBy field
  const superadmin = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });

  if (!superadmin) {
    console.error(
      "  ❌ No SUPERADMIN user found. Run `npx tsx scripts/seed.ts` first."
    );
    process.exit(1);
  }
  console.log(`  ✅ Found SUPERADMIN: ${superadmin.email} (${superadmin.id})`);

  // ─── 2. Create students ──────────────────────────────────────

  console.log("\n━━━ 2. CREATING STUDENTS ━━━━━━━━━━━━━━━━━━━━━━━━━");

  const studentCount = ALL_NAMES.length; // 50
  const createdStudents: { id: string; name: string; profile: string }[] = [];

  for (let i = 0; i < studentCount; i++) {
    const name = ALL_NAMES[i];
    const indexNumber = formatIndex(FIRST_INDEX + i);
    const profile = getProfile(i);

    // Distribute students across class groups round-robin
    const classGroup = classGroups[i % classGroups.length];

    // Random electives
    const electives = {
      categoryI: pick(ELECTIVE_I),
      categoryII: pick(ELECTIVE_II),
      categoryIII: pick(ELECTIVE_III),
    };

    // ~25% of students get scholarship marks (100-200 range)
    const scholarshipMarks =
      Math.random() < 0.25 ? randInt(100, 200) : null;

    const student = await prisma.student.create({
      data: {
        name,
        indexNumber,
        classId: classGroup.id,
        electives,
        scholarshipMarks,
        isDeleted: false,
      },
    });

    createdStudents.push({ id: student.id, name, profile });

    const grade = classGroup.grade;
    const section = classGroup.section;
    const profileLabel =
      profile === "high" ? "🟢" : profile === "low" ? "🔴" : "🟡";
    console.log(
      `  ✅ ${indexNumber} - ${name.padEnd(30)} Grade ${grade}${section}  ${profileLabel} ${profile}`
    );
  }

  console.log(`\n  📊 Total students created: ${createdStudents.length}`);

  // ─── 3. Create mark records ──────────────────────────────────

  console.log("\n━━━ 3. CREATING MARK RECORDS ━━━━━━━━━━━━━━━━━━━━━");

  let markCount = 0;
  const totalExpected = createdStudents.length * YEARS.length * TERMS.length;

  for (const student of createdStudents) {
    const profile = student.profile as "high" | "average" | "low";

    for (const year of YEARS) {
      for (const term of TERMS) {
        const marks = generateMarks(profile);

        await prisma.markRecord.create({
          data: {
            studentId: student.id,
            term,
            year,
            marks,
            updatedBy: superadmin.id,
          },
        });

        markCount++;
      }
    }

    // Log progress every 10 students
    if (markCount % (10 * YEARS.length * TERMS.length) === 0) {
      const pct = Math.round((markCount / totalExpected) * 100);
      console.log(
        `  📝 Progress: ${markCount}/${totalExpected} mark records (${pct}%)`
      );
    }
  }

  console.log(`  ✅ Created ${markCount} mark records total`);
  console.log(
    `     (${createdStudents.length} students × ${YEARS.length} years × ${TERMS.length} terms)`
  );
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       SchoolMS - Mock Data Seeder               ║");
  console.log("╚══════════════════════════════════════════════════╝");

  await seedMockStudents();

  console.log("\n══════════════════════════════════════════════════");
  console.log("  🎉 Mock data seeding complete!");
  console.log("══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Mock data seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
