import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/dashboard/calendar/CalendarClient";

export const metadata = { title: "Meeting Calendar" };

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <CalendarClient role={session.user.role} />;
}
