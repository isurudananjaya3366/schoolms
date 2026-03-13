/**
 * Large dataset seeder for SchoolMS.
 *
 * Usage:
 *   npx tsx scripts/seed-large-dataset.ts
 *
 * What it does:
 *   1. Clears all existing students and mark records.
 *   2. Creates 30–40 students per class (all 12 classes: 10A–F, 11A–F).
 *   3. For each student, adds mark records for:
 *        - 2023 TERM_1, TERM_2, TERM_3
 *        - 2024 TERM_1, TERM_2, TERM_3
 *        - 2025 TERM_1, TERM_2, TERM_3
 *        - 2026 TERM_1 only
 *   4. Adds throttle delays between batches to avoid hitting
 *      MongoDB Atlas free-tier rate limits.
 *
 * Prerequisites:
 *   - Class groups for grades 10 and 11 must already exist.
 *   - A SUPERADMIN user must exist (for updatedBy field).
 */

import { PrismaClient, Term } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Configuration ────────────────────────────────────────────────

/** Students to create per class group (randomised per class). */
const MIN_STUDENTS_PER_CLASS = 30;
const MAX_STUDENTS_PER_CLASS = 40;

/**
 * Years and terms representing real school data:
 *   - 2023–2025: all three terms
 *   - 2026: first term only (current/partial year)
 */
const TERM_SCHEDULE: { year: number; terms: Term[] }[] = [
  { year: 2023, terms: ["TERM_1", "TERM_2", "TERM_3"] },
  { year: 2024, terms: ["TERM_1", "TERM_2", "TERM_3"] },
  { year: 2025, terms: ["TERM_1", "TERM_2", "TERM_3"] },
  { year: 2026, terms: ["TERM_1"] },
];

/**
 * Delay in ms after each class group's student+marks batch.
 * Keeps writes well under MongoDB Atlas free-tier limits.
 */
const DELAY_BETWEEN_CLASSES_MS = 800;

/** Delay in ms after each sub-batch of mark records inside a class. */
const DELAY_BETWEEN_MARK_BATCHES_MS = 300;

/** How many students' marks to write before a sub-batch delay. */
const MARK_BATCH_SIZE = 5;

// ─── Sri Lankan name pools ────────────────────────────────────────

const MALE_NAMES = [
  "Kavindu Perera", "Sahan Silva", "Tharindu Fernando", "Dinesh Jayawardena",
  "Amila Bandara", "Nuwan Kumara", "Chaminda Rajapaksha", "Lasith Malinga",
  "Dhananjaya De Silva", "Kasun Weerasinghe", "Isuru Udana", "Thilan Samaraweera",
  "Lahiru Thirimanne", "Dimuth Karunaratne", "Charith Asalanka", "Kusal Mendis",
  "Pathum Nissanka", "Dasun Shanaka", "Dunith Wellalage", "Wanindu Hasaranga",
  "Asitha Fernando", "Maheesh Theekshana", "Shanaka Liyanage", "Minod Bhanuka",
  "Pramod Madushan", "Kamindu Mendis", "Sandun Weerakkody", "Lakshan Gamage",
  "Chamara Nethmina", "Pawan Rathnayake", "Ruchira Perera", "Vishwa Bandara",
  "Kamal Wijesekara", "Nimesh Pathirana", "Yasiru Kumara", "Anjana Jayasinghe",
  "Malitha Vithanage", "Supun Dissanayake", "Dilan Madushanka", "Thilanka Kandamby",
  "Roshan Abeywickrama", "Pradeep Mahesh", "Sachith Pathirana", "Upul Tharaka",
  "Jehan Mubarak", "Dilruwan Perera", "Suranga Lakmal", "Sadeera Samarawickrama",
  "Avishka Fernando", "Oshada Fernando", "Niroshan Dickwella", "Bhanuka Rajapaksa",
  "Akila Dananjaya", "Dilshan Madushanka", "Chamika Karunaratne", "Angelo Mathews",
  "Thisara Perera", "Asela Gunaratne", "Dhammika Prasad", "Chamara Kapugedera",
];

const FEMALE_NAMES = [
  "Nethmi Senaratne", "Saduni Ratnayake", "Ishani De Silva", "Malsha Wickramasinghe",
  "Sewmini Kumarasinghe", "Tharushi Jayasuriya", "Dinusha Herath", "Kavisha Dilhara",
  "Hansani Weerasooriya", "Sanumi Liyanage", "Nimasha Priyangika", "Poorna Kavindya",
  "Sachini Perera", "Dulani Kumari", "Imesha Madushani", "Nilmini Thilakarathne",
  "Pavithra Wanniarachchi", "Hiruni Samaratunga", "Yashoda Pathirana", "Senali Gunawardena",
  "Udeni Jayathilaka", "Ruwanthi Perera", "Chamodi Lakshika", "Dilini Edirisinghe",
  "Thilini Thennakoon", "Piyumi Wijesundara", "Shanika Mendis", "Rangi Perera",
  "Navoda Rajapaksha", "Hesitha Fernando", "Amaya De Silva", "Yenuli Weerasooriya",
  "Thisuri Kodikara", "Vinudi Bandara", "Nirmali Jayakody", "Sandali Karunarathna",
  "Dewmini Rathnasiri", "Sithumi Herath", "Navindi Amarasinghe", "Pubudu Priyadarshani",
];

/** All names combined. */
const ALL_NAMES = [...MALE_NAMES, ...FEMALE_NAMES];

// ─── Elective subject pools ───────────────────────────────────────

const ELECTIVE_I = ["Geography", "Civic Studies", "Accounting", "Tamil"];

const ELECTIVE_II = [
  "Art", "Dancing", "Music", "Drama & Theatre",
  "Sinhala Literature", "English Literature",
];

const ELECTIVE_III = [
  "Health", "ICT", "Agriculture", "Art & Crafts",
  "Electrical & Electronic Tech.", "Construction Tech.",
];

// ─── Helpers ──────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatIndex(n: number): string {
  return `STU${String(n).padStart(4, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProfile(i: number): "high" | "average" | "low" {
  if (i % 5 === 0) return "high";     // ~20% high achievers
  if (i % 7 === 1) return "low";      // ~14% low performers
  return "average";                    // ~66% average
}

function generateMark(profile: "high" | "average" | "low"): number | null {
  if (Math.random() < 0.05) return null; // 5% absent/no mark

  switch (profile) {
    case "high":
      return randInt(72, 99);
    case "low":
      return Math.random() < 0.35 ? randInt(5, 34) : randInt(20, 49);
    default:
      return Math.random() < 0.1 ? randInt(25, 45) : randInt(42, 88);
  }
}

function generateMarks(profile: "high" | "average" | "low") {
  return {
    sinhala:   generateMark(profile),
    buddhism:  generateMark(profile),
    maths:     generateMark(profile),
    science:   generateMark(profile),
    english:   generateMark(profile),
    history:   generateMark(profile),
    categoryI:   generateMark(profile),
    categoryII:  generateMark(profile),
    categoryIII: generateMark(profile),
  };
}

// ─── Main seeder ──────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        SchoolMS — Large Dataset Seeder                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Step 1: Pre-flight ──────────────────────────────────────────
  console.log("━━━ 1. PRE-FLIGHT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const classGroups = await prisma.classGroup.findMany({
    where: { grade: { in: [10, 11] } },
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });

  if (classGroups.length === 0) {
    console.error("  ❌ No class groups found. Run seed.ts first.");
    process.exit(1);
  }
  console.log(`  ✅ Found ${classGroups.length} class groups`);

  const superadmin = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });
  if (!superadmin) {
    console.error("  ❌ No SUPERADMIN found. Run seed.ts first.");
    process.exit(1);
  }
  console.log(`  ✅ SUPERADMIN: ${superadmin.email}`);

  // ── Step 2: Clear existing data ─────────────────────────────────
  console.log("\n━━━ 2. CLEARING EXISTING DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const deletedMarks = await prisma.markRecord.deleteMany({});
  console.log(`  🗑  Deleted ${deletedMarks.count} mark records`);

  const deletedStudents = await prisma.student.deleteMany({});
  console.log(`  🗑  Deleted ${deletedStudents.count} students`);

  // ── Step 3: Create students and marks ───────────────────────────
  console.log("\n━━━ 3. SEEDING STUDENTS & MARKS ━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let globalIndex = 1;
  let totalStudents = 0;
  let totalMarks = 0;

  // Calculate total expected mark records for ETA
  const termsPerStudent = TERM_SCHEDULE.reduce(
    (sum, { terms }) => sum + terms.length, 0
  );
  console.log(
    `  📋 Term schedule: ${termsPerStudent} mark records per student\n`
  );

  for (const group of classGroups) {
    const classLabel = `Grade ${group.grade}${group.section}`;
    const studentCount = randInt(MIN_STUDENTS_PER_CLASS, MAX_STUDENTS_PER_CLASS);

    console.log(
      `\n  ┌─ ${classLabel} — creating ${studentCount} students ─────────────`
    );

    // Shuffle names for variety per class
    const shuffledNames = [...ALL_NAMES].sort(() => Math.random() - 0.5);

    const classStudents: { id: string; profile: "high" | "average" | "low" }[] = [];

    for (let i = 0; i < studentCount; i++) {
      const name = shuffledNames[i % shuffledNames.length];
      const indexNumber = formatIndex(globalIndex++);
      const profile = getProfile(i);
      const electives = {
        categoryI:   pick(ELECTIVE_I),
        categoryII:  pick(ELECTIVE_II),
        categoryIII: pick(ELECTIVE_III),
      };
      const scholarshipMarks = Math.random() < 0.2 ? randInt(100, 200) : null;

      const student = await prisma.student.create({
        data: {
          name,
          indexNumber,
          classId: group.id,
          electives,
          scholarshipMarks,
          isDeleted: false,
        },
      });

      classStudents.push({ id: student.id, profile });
      totalStudents++;

      const icon = profile === "high" ? "🟢" : profile === "low" ? "🔴" : "🟡";
      console.log(`  │  ${indexNumber}  ${name.padEnd(32)} ${icon}`);
    }

    console.log(`  │`);
    console.log(`  │  Creating mark records…`);

    // Create mark records in sub-batches
    let classMarkCount = 0;

    for (let bi = 0; bi < classStudents.length; bi += MARK_BATCH_SIZE) {
      const batch = classStudents.slice(bi, bi + MARK_BATCH_SIZE);

      for (const s of batch) {
        for (const { year, terms } of TERM_SCHEDULE) {
          for (const term of terms) {
            await prisma.markRecord.create({
              data: {
                studentId: s.id,
                term,
                year,
                marks: generateMarks(s.profile),
                updatedBy: superadmin.id,
              },
            });
            classMarkCount++;
            totalMarks++;
          }
        }
      }

      const pct = Math.round((classMarkCount / (classStudents.length * termsPerStudent)) * 100);
      console.log(
        `  │  ${classMarkCount}/${classStudents.length * termsPerStudent} marks (${pct}%)`
      );

      // Sub-batch delay to avoid rate limiting
      if (bi + MARK_BATCH_SIZE < classStudents.length) {
        await sleep(DELAY_BETWEEN_MARK_BATCHES_MS);
      }
    }

    console.log(
      `  └─ ✅ ${classLabel}: ${classStudents.length} students, ` +
      `${classMarkCount} mark records`
    );

    // Inter-class delay
    await sleep(DELAY_BETWEEN_CLASSES_MS);
  }

  // ── Step 4: Summary ─────────────────────────────────────────────
  console.log("\n\n══════════════════════════════════════════════════════════");
  console.log("  🎉 Seeding complete!");
  console.log(`  📊 Students created : ${totalStudents}`);
  console.log(`  📊 Mark records     : ${totalMarks}`);
  console.log(`  📊 Class groups     : ${classGroups.length}`);
  console.log("══════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seeder failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
