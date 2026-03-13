import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportsClient from "@/components/reports/ReportsClient";

export const metadata = { title: "Student Reports | SchoolMS" };

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <ReportsClient
      role={session.user.role as string}
      userId={session.user.id}
      userName={session.user.name || ""}
    />
  );
}
