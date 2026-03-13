import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LeaderboardContainer from "./LeaderboardContainer";

export const metadata = { title: "Leaderboard | SchoolMS" };

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (role === "STAFF") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Top performers across classes and sections. Select a grade and class to drill into
          class-level rankings, or view the grade-wide section rankings.
        </p>
      </div>
      <LeaderboardContainer />
    </div>
  );
}
