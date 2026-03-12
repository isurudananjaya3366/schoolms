import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuditLogViewer from "./_components/AuditLogViewer";

export const metadata = { title: "Audit Log | SchoolMS" };

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as string) !== "SUPERADMIN") redirect("/dashboard");
  return <AuditLogViewer />;
}
