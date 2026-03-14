import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import PasswordRequestsClient from "@/components/settings/PasswordRequestsClient";

export default async function PasswordRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.SUPERADMIN) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PasswordRequestsClient />
    </div>
  );
}
