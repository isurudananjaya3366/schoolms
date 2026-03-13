import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import UserTable from "./UserTable";

export const metadata = { title: "User Management | SchoolMS" };

export default async function UserManagementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.SUPERADMIN) redirect("/dashboard");

  const userSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
  };

  let users;
  if (role === Role.SUPERADMIN) {
    users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  } else {
    users = await prisma.user.findMany({
      where: { OR: [{ role: Role.STAFF }, { role: Role.TEACHER }, { role: Role.STUDENT }, { id: session.user.id }] },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="space-y-4">
      <UserTable
        users={JSON.parse(JSON.stringify(users))}
        currentUserId={session.user.id}
        currentUserRole={role}
      />
    </div>
  );
}
