/**
 * Seed script to create the SUPERADMIN user.
 *
 * Usage:
 *   npx tsx scripts/seed-superadmin.ts
 *
 * This creates a SUPERADMIN user if none exists.
 * Credentials:
 *   Email:    superadmin@schoolms.com
 *   Password: SuperAdmin@123
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
  });

  if (existing) {
    console.log("✅ SUPERADMIN already exists:", existing.email);
    return;
  }

  const passwordHash = await hash("SuperAdmin@123", 12);

  const user = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "superadmin@schoolms.com",
      passwordHash,
      role: "SUPERADMIN",
      isActive: true,
    },
  });

  console.log("✅ SUPERADMIN created successfully!");
  console.log("   Email:    superadmin@schoolms.com");
  console.log("   Password: SuperAdmin@123");
  console.log("   ID:      ", user.id);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding superadmin:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
