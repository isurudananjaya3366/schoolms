import prisma from "../lib/prisma";

async function seedElectiveDefaults() {
  const updates = [
    {
      key: "elective_label_I",
      value: JSON.stringify([
        "Geography",
        "Civic Studies",
        "Accounting",
        "Tamil",
      ]),
    },
    {
      key: "elective_label_II",
      value: JSON.stringify([
        "Art",
        "Dancing",
        "Music",
        "Drama & Theatre",
        "Sinhala Literature",
        "English Literature",
      ]),
    },
    {
      key: "elective_label_III",
      value: JSON.stringify([
        "Health",
        "ICT",
        "Agriculture",
        "Art & Crafts",
        "Electrical & Electronic Tech.",
        "Construction Tech.",
      ]),
    },
  ];

  for (const { key, value } of updates) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    console.log("Updated:", key, "->", value);
  }

  await prisma.$disconnect();
  console.log("Done! Elective defaults seeded.");
}

seedElectiveDefaults().catch((e) => {
  console.error(e);
  process.exit(1);
});
