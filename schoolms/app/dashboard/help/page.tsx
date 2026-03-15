import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import HelpClient from "./HelpClient";

export const metadata = { title: "Help & Guide | SchoolMS" };

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;

  // STUDENT role has no dashboard access; redirect them
  if (role === "STUDENT") redirect("/student");

  return <HelpClient role={role} displayName={session.user.name ?? ""} />;
}
