import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import KpiCard from "@/components/dashboard/KpiCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import QuickActions from "@/components/dashboard/QuickActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, AlertCircle, TrendingDown } from "lucide-react";

async function getKpiData() {
  // Get current config values
  let currentYear = new Date().getFullYear().toString();
  let currentTerm = "TERM_1";

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ["academic_year", "current_term"] } },
    });
    for (const c of configs) {
      if (c.key === "academic_year") currentYear = c.value;
      if (c.key === "current_term") currentTerm = c.value;
    }
  } catch {
    // use defaults
  }

  // Run all 4 KPI queries in parallel with individual error handling
  const [totalStudents, markRecords, pendingEntry, wRate] = await Promise.all([
    // KPI 1: Total Students
    (async () => {
      try {
        const count = await prisma.student.count({ where: { isDeleted: false } });
        return { value: count, error: false, subtitle: "active students" };
      } catch {
        return { value: null, error: true, subtitle: "" };
      }
    })(),

    // KPI 2: Mark Records This Term
    (async () => {
      try {
        const count = await prisma.markRecord.count({
          where: { year: parseInt(currentYear) || new Date().getFullYear(), term: currentTerm as "TERM_1" | "TERM_2" | "TERM_3" },
        });
        return { value: count, error: false, subtitle: `${currentTerm.replace("_", " ")} ${currentYear}` };
      } catch {
        return { value: null, error: true, subtitle: "" };
      }
    })(),

    // KPI 3: Pending Mark Entry
    (async () => {
      try {
        const totalActive = await prisma.student.count({ where: { isDeleted: false } });
        const withRecords = await prisma.markRecord.groupBy({
          by: ["studentId"],
          where: { year: parseInt(currentYear) || new Date().getFullYear(), term: currentTerm as "TERM_1" | "TERM_2" | "TERM_3" },
        });
        const pending = totalActive - withRecords.length;
        const pct = totalActive > 0 ? Math.round((pending / totalActive) * 100) : 0;
        return { value: pending, error: false, subtitle: `${pct}% of enrolled students` };
      } catch {
        return { value: null, error: true, subtitle: "" };
      }
    })(),

    // KPI 4: W-Rate This Term
    (async () => {
      try {
        const records = await prisma.markRecord.findMany({
          where: { year: parseInt(currentYear) || new Date().getFullYear(), term: currentTerm as "TERM_1" | "TERM_2" | "TERM_3" },
          select: { marks: true },
        });
        if (records.length === 0) {
          return { value: "0%", error: false, subtitle: "No marks entered yet" };
        }
        let total = 0;
        let belowThreshold = 0;
        const W_THRESHOLD = 35;
        for (const record of records) {
          const m = record.marks;
          const markValues = [m.sinhala, m.buddhism, m.maths, m.science, m.english, m.history, m.categoryI, m.categoryII, m.categoryIII];
          for (const val of markValues) {
            if (val !== null && val !== undefined) {
              total++;
              if (val < W_THRESHOLD) belowThreshold++;
            }
          }
        }
        const rate = total > 0 ? ((belowThreshold / total) * 100).toFixed(1) : "0";
        return { value: `${rate}%`, error: false, subtitle: `${belowThreshold} marks below threshold` };
      } catch {
        return { value: null, error: true, subtitle: "" };
      }
    })(),
  ]);

  return { totalStudents, markRecords, pendingEntry, wRate };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const kpi = await getKpiData();

  // Fetch recent activity
  let recentActivity: Array<{
    id: string;
    timestamp: Date;
    userId: string | null;
    userDisplayName: string;
    action: string;
    targetId: string | null;
    targetType: string | null;
    ipAddress: string | null;
    details: string;
  }> = [];
  try {
    recentActivity = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
    });
  } catch {
    // empty on error
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Students"
          value={kpi.totalStudents.value}
          subtitle={kpi.totalStudents.subtitle}
          icon={Users}
          isError={kpi.totalStudents.error}
        />
        <KpiCard
          title="Mark Records"
          value={kpi.markRecords.value}
          subtitle={kpi.markRecords.subtitle}
          icon={FileText}
          isError={kpi.markRecords.error}
        />
        <KpiCard
          title="Pending Entry"
          value={kpi.pendingEntry.value}
          subtitle={kpi.pendingEntry.subtitle}
          icon={AlertCircle}
          isError={kpi.pendingEntry.error}
        />
        <KpiCard
          title="W-Rate"
          value={kpi.wRate.value}
          subtitle={kpi.wRate.subtitle}
          icon={TrendingDown}
          isError={kpi.wRate.error}
        />
      </div>

      {/* Activity Feed and Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={recentActivity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
