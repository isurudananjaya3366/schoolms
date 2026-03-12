"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import StudentSearchPanel from "@/components/reports/StudentSearchPanel";
import ReportPreviewPanel from "@/components/reports/ReportPreviewPanel";
import RecentReportsList from "@/components/reports/RecentReportsList";
import SignatureSelector from "@/components/reports/SignatureSelector";
import EmailReportDialog from "@/components/reports/EmailReportDialog";

interface ReportsClientProps {
  role: string;
  userId: string;
  userName: string;
}

interface SelectedStudent {
  id: string;
  name: string;
  indexNumber: string;
  className?: string;
}

interface SignatureOptions {
  classTeacherField: boolean;
  classTeacherDigital: boolean;
  principalField: boolean;
  principalDigital: boolean;
  vicePrincipalField: boolean;
  vicePrincipalDigital: boolean;
}

export default function ReportsClient({ role }: ReportsClientProps) {
  const searchParams = useSearchParams();
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Auto-populate student from URL search params (e.g. navigating from student profile)
  useEffect(() => {
    const studentId = searchParams.get("studentId");
    const studentName = searchParams.get("studentName");
    const indexNumber = searchParams.get("indexNumber");
    const className = searchParams.get("className");

    if (studentId && studentName && indexNumber) {
      setSelectedStudent({
        id: studentId,
        name: studentName,
        indexNumber,
        className: className || undefined,
      });
    }
  }, [searchParams]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureOptions, setSignatureOptions] = useState<SignatureOptions>({
    classTeacherField: false,
    classTeacherDigital: false,
    principalField: false,
    principalDigital: false,
    vicePrincipalField: false,
    vicePrincipalDigital: false,
  });
  const [availableSignatures, setAvailableSignatures] = useState<{
    hasClassTeacher: boolean;
    hasPrincipal: boolean;
    hasVicePrincipal: boolean;
  }>({ hasClassTeacher: false, hasPrincipal: false, hasVicePrincipal: false });
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Check if email provider is configured
  useEffect(() => {
    async function checkEmailConfig() {
      try {
        const res = await fetch("/api/settings/secure");
        if (!res.ok) return;
        const data = await res.json();
        const keys: { key: string; hasDbValue: boolean; hasEnvFallback: boolean }[] =
          data.keys || [];
        const resend = keys.find((k) => k.key === "RESEND_API_KEY");
        const smtp = keys.find((k) => k.key === "SMTP_HOST");
        setEmailConfigured(
          !!(resend?.hasDbValue || resend?.hasEnvFallback || smtp?.hasDbValue || smtp?.hasEnvFallback)
        );
      } catch {
        // silently fail — email button stays disabled
      }
    }
    checkEmailConfig();
  }, []);

  // Check available signatures when student changes
  useEffect(() => {
    if (!selectedStudent) return;

    async function checkSignatures() {
      try {
        const res = await fetch("/api/uploads/signature");
        if (!res.ok) return;
        const data = await res.json();
        const sigs: { type: string; classLabel: string | null }[] = data.signatures || [];

        // Extract className from student — fetch if not available
        let className = selectedStudent?.className;
        if (!className && selectedStudent) {
          try {
            const studentRes = await fetch(`/api/students/${selectedStudent.id}`);
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              className = studentData.class
                ? `${studentData.class.grade}${studentData.class.section}`
                : undefined;
            }
          } catch { /* ignore */ }
        }

        setAvailableSignatures({
          hasClassTeacher: sigs.some(
            (s) => s.type === "class_teacher" && s.classLabel === className
          ),
          hasPrincipal: sigs.some((s) => s.type === "principal"),
          hasVicePrincipal: sigs.some((s) => s.type === "vice_principal"),
        });
      } catch {
        // silently fail
      }
    }

    checkSignatures();
  }, [selectedStudent]);

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
      const params = new URLSearchParams({
        year: String(selectedYear),
      });
      if (signatureOptions.classTeacherField) params.set("classTeacherField", "true");
      if (signatureOptions.classTeacherDigital) params.set("classTeacherDigital", "true");
      if (signatureOptions.principalField) params.set("principalField", "true");
      if (signatureOptions.principalDigital) params.set("principalDigital", "true");
      if (signatureOptions.vicePrincipalField) params.set("vicePrincipalField", "true");
      if (signatureOptions.vicePrincipalDigital) params.set("vicePrincipalDigital", "true");

      const res = await fetch(
        `/api/reports/${selectedStudent.id}?${params.toString()}`
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
  }, [selectedStudent, selectedYear, pdfBlobUrl, signatureOptions]);

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

          {/* Signature Options */}
          {selectedStudent && (
            <SignatureSelector
              signatureOptions={signatureOptions}
              onSignatureOptionsChange={setSignatureOptions}
              availableSignatures={availableSignatures}
            />
          )}

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
            onEmail={() => setShowEmailDialog(true)}
            emailConfigured={emailConfigured}
          />
        </div>
      </div>

      {showEmailDialog && selectedStudent && selectedYear && (
        <EmailReportDialog
          open={showEmailDialog}
          onClose={() => setShowEmailDialog(false)}
          studentName={selectedStudent.name}
          studentIndexNumber={selectedStudent.indexNumber}
          year={selectedYear}
          studentId={selectedStudent.id}
          signatureOptions={signatureOptions}
        />
      )}
    </div>
  );
}
