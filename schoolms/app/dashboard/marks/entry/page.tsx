import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import MarkEntryClient from "@/components/marks/MarkEntryClient";

export default async function MarkEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!(await hasPermission(session.user.role, "edit_marks"))) redirect("/dashboard");

  return <MarkEntryClient role={session.user.role} />;
}
