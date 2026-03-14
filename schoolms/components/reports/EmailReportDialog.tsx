"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Send, X, Loader2 } from "lucide-react";

interface EmailReportDialogProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  studentIndexNumber: string;
  year: number;
  studentId: string;
  signatureOptions: {
    classTeacherField: boolean;
    classTeacherDigital: boolean;
    principalField: boolean;
    principalDigital: boolean;
    vicePrincipalField: boolean;
    vicePrincipalDigital: boolean;
  };
}

export default function EmailReportDialog({
  open,
  onClose,
  studentName,
  studentIndexNumber,
  year,
  studentId,
  signatureOptions,
}: EmailReportDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState(
    `Progress Report - ${studentName} (${year})`
  );
  const [body, setBody] = useState(
    `Dear Parent/Guardian,\n\nPlease find attached the progress report for ${studentName} (Index: ${studentIndexNumber}) for the academic year ${year}.\n\nBest regards,\nSchool Administration`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      setError("Recipient email is required");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          year,
          recipientEmail: recipientEmail.trim(),
          subject,
          body,
          classTeacherField: signatureOptions.classTeacherField,
          classTeacherDigital: signatureOptions.classTeacherDigital,
          principalField: signatureOptions.principalField,
          principalDigital: signatureOptions.principalDigital,
          vicePrincipalField: signatureOptions.vicePrincipalField,
          vicePrincipalDigital: signatureOptions.vicePrincipalDigital,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to send email");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setError("Network error - could not reach server");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <Card className="w-full max-w-lg mx-4 shadow-xl">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Email Progress Report</h2>
                <p className="text-sm text-muted-foreground">
                  {studentName} - {year}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Success message */}
          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              Email sent successfully!
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipient-email">Recipient Email</Label>
              <input
                id="recipient-email"
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="parent@example.com"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <input
                id="email-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body">Message</Label>
              <textarea
                id="email-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || success}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
