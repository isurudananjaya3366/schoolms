import prisma from "@/lib/prisma";

export async function seedClassGroups(): Promise<{ created: number; skipped: boolean }> {
  const existing = await prisma.classGroup.count();
  if (existing > 0) {
    return { created: 0, skipped: true };
  }

  const grades = [6, 7, 8, 9, 10, 11];
  const sections = ["A", "B", "C", "D", "E", "F"];
  const data: { grade: number; section: string }[] = [];

  for (const grade of grades) {
    for (const section of sections) {
      data.push({ grade, section });
    }
  }

  const result = await prisma.classGroup.createMany({
    data,
  });

  return { created: result.count, skipped: false };
}
