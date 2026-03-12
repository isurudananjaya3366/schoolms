import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import SchoolNameForm from "./SchoolNameForm";
import AcademicYearForm from "./AcademicYearForm";
import SubjectConfigForm from "./SubjectConfigForm";
import ClassGroupsSection from "./ClassGroupsSection";
import ApiKeysSection from "./ApiKeysSection";

export const metadata = { title: "Settings | SchoolMS" };

const DEFAULT_CORE_SUBJECTS: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Mathematics",
  science: "Science",
  english: "English",
  history: "History",
};

const DEFAULTS: Record<string, string> = {
  school_name: "SchoolMS",
  academic_year: new Date().getFullYear().toString(),
  elective_label_I: JSON.stringify(["Geography", "Civic Studies", "Accounting", "Tamil"]),
  elective_label_II: JSON.stringify(["Art", "Dancing", "Music", "Drama & Theatre", "Sinhala Literature", "English Literature"]),
  elective_label_III: JSON.stringify(["Health", "ICT", "Agriculture", "Art & Crafts", "Electrical & Electronic Tech.", "Construction Tech."]),
  core_subjects: JSON.stringify(DEFAULT_CORE_SUBJECTS),
  school_logo_url: "",
};

/** Parse a SystemConfig value as a string array.
 *  If it's a valid JSON array, return it; otherwise wrap the plain string. */
function parseSubjects(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    // Not JSON — treat as a single-element array
  }
  return value ? [value] : [];
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.SUPERADMIN) redirect("/dashboard");

  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "school_name",
          "academic_year",
          "elective_label_I",
          "elective_label_II",
          "elective_label_III",
          "core_subjects",
          "school_logo_url",
        ],
      },
    },
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
  const settings: Record<string, string> = {};
  for (const key of Object.keys(DEFAULTS)) {
    settings[key] = configMap[key] || DEFAULTS[key];
  }

  const subjectsI = parseSubjects(settings.elective_label_I);
  const subjectsII = parseSubjects(settings.elective_label_II);
  const subjectsIII = parseSubjects(settings.elective_label_III);

  let coreSubjects: Record<string, string> = { ...DEFAULT_CORE_SUBJECTS };
  try {
    const parsed = JSON.parse(settings.core_subjects);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      coreSubjects = { ...DEFAULT_CORE_SUBJECTS, ...parsed };
    }
  } catch {
    // Use defaults
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SchoolNameForm initialValue={settings.school_name} initialLogoUrl={settings.school_logo_url} />
      <AcademicYearForm initialValue={settings.academic_year} />
      <SubjectConfigForm
        initialCoreSubjects={coreSubjects}
        initialSubjectsI={subjectsI}
        initialSubjectsII={subjectsII}
        initialSubjectsIII={subjectsIII}
      />
      <ClassGroupsSection />
      {role === Role.SUPERADMIN && <ApiKeysSection />}
    </div>
  );
}
