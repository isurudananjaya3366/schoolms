import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/dashboard/notifications/NotificationsClient";

export const metadata = { title: "Notifications — SchoolMS" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // STUDENT role gets no notifications per spec
  if (session.user.role === "STUDENT") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl p-6">
      <NotificationsClient />
    </div>
  );
}
