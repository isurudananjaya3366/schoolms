"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import StudentSearchPanel from "@/components/reports/StudentSearchPanel";
import ReportPreviewPanel from "@/components/reports/ReportPreviewPanel";
import RecentReportsList from "@/components/reports/RecentReportsList";

interface ReportsClientProps {
  role: string;
  userId: string;
  userName: string;
}

interface SelectedStudent {
  id: string;
  name: string;
  indexNumber: string;
}

export default function ReportsClient({ role }: ReportsClientProps) {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStudentSelect = useCallback((student: SelectedStudent) => {
    setSelectedStudent(student);
    setPdfBlobUrl(null);
    setError(null);
  }, []);

  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
    setPdfBlobUrl(null);
    setError(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!selectedStudent || !selectedYear) return;

    setLoading(true);
    setError(null);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }

    try {
      const res = await fetch(
        `/api/reports/${selectedStudent.id}?year=${selectedYear}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 404) {
          setError(body?.error || "Student not found");
        } else if (res.status === 422) {
          setError(body?.error || "No marks entered for the selected year");
        } else {
          setError(body?.error || "Failed to generate report");
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, selectedYear, pdfBlobUrl]);

  const isAdminOrAbove = role === "ADMIN" || role === "SUPERADMIN";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and download student progress reports
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Student</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentSearchPanel
                onStudentSelect={handleStudentSelect}
                onYearChange={handleYearChange}
                selectedStudent={selectedStudent}
                selectedYear={selectedYear}
              />
            </CardContent>
          </Card>

          {isAdminOrAbove && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentReportsList
                  role={role}
                  onStudentSelect={handleStudentSelect}
                  onYearChange={handleYearChange}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          <ReportPreviewPanel
            selectedStudent={selectedStudent}
            selectedYear={selectedYear}
            pdfBlobUrl={pdfBlobUrl}
            loading={loading}
            error={error}
            onPreview={handlePreview}
          />
        </div>
      </div>
    </div>
  );
}
