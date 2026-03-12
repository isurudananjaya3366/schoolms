import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MarkEntryClient from "@/components/marks/MarkEntryClient";

export default async function MarkEntryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <MarkEntryClient role={session.user.role} />;
}
