import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BackupDashboard from "./_components/BackupDashboard";

export const metadata = { title: "Backup Management | SchoolMS" };

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as string) !== "SUPERADMIN") redirect("/dashboard");
  return <BackupDashboard />;
}
