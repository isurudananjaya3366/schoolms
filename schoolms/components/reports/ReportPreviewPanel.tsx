"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  Download,
  Printer,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";

interface SelectedStudent {
  id: string;
  name: string;
  indexNumber: string;
}

interface ReportPreviewPanelProps {
  selectedStudent: SelectedStudent | null;
  selectedYear: number | null;
  pdfBlobUrl: string | null;
  loading: boolean;
  error: string | null;
  onPreview: () => void;
}

export default function ReportPreviewPanel({
  selectedStudent,
  selectedYear,
  pdfBlobUrl,
  loading,
  error,
  onPreview,
}: ReportPreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDownload = () => {
    if (!pdfBlobUrl || !selectedStudent || !selectedYear) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `Progress_Report_${selectedStudent.indexNumber}_${selectedYear}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const canPreview = !!selectedStudent && !!selectedYear && !loading;

  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              onClick={onPreview}
              disabled={!canPreview}
              size="sm"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview Report
            </Button>

            <Button
              onClick={handleDownload}
              disabled={!pdfBlobUrl}
              variant="outline"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>

            <Button
              onClick={handlePrint}
              disabled={!pdfBlobUrl}
              variant="outline"
              size="sm"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>

          {selectedStudent && (
            <span className="text-sm text-muted-foreground">
              {selectedStudent.name} — {selectedYear}
            </span>
          )}
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview area */}
        <div className="relative min-h-[600px] rounded-md border bg-muted/30">
          {pdfBlobUrl ? (
            <iframe
              ref={iframeRef}
              src={pdfBlobUrl}
              className="h-[700px] w-full rounded-md"
              title="PDF Preview"
            />
          ) : (
            <div className="flex h-[600px] flex-col items-center justify-center text-muted-foreground">
              {loading ? (
                <>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin" />
                  <p className="text-sm">Generating report…</p>
                </>
              ) : (
                <>
                  <FileText className="mb-3 h-10 w-10" />
                  <p className="text-sm">
                    {selectedStudent
                      ? "Click \"Preview Report\" to generate the PDF"
                      : "Select a student and year to get started"}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
