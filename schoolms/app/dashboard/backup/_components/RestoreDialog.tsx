"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BackupHistoryEntry {
  fileId: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  storageProvider: string;
  status: "success" | "failed";
  errorMessage?: string;
}

interface RestoreDialogProps {
  backup?: BackupHistoryEntry | null;
  file?: File | null;
  onClose: () => void;
  onComplete: () => void;
}

export default function RestoreDialog({
  backup,
  file,
  onClose,
  onComplete,
}: RestoreDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const isOpen = !!backup || !!file;
  const isConfirmed = confirmation === "RESTORE";

  const handleRestore = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setProgress(0);
    setStatusMessage("Starting restore…");

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/backup/restore", {
          method: "POST",
          body: formData,
        });
      } else if (backup) {
        res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: backup.fileId }),
        });
      } else {
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/x-ndjson") && res.body) {
        // Streaming NDJSON - read progress updates
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "progress") {
                setProgress(event.percent ?? 0);
                setStatusMessage(event.message ?? "");
              } else if (event.type === "done") {
                setProgress(100);
                setStatusMessage("Restore complete!");
                const countSummary = event.counts
                  ? Object.entries(event.counts as Record<string, number>)
                      .filter(([k]) => !k.startsWith("_"))
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")
                  : "";
                toast.success(
                  `Restore complete${countSummary ? ` - ${countSummary}` : ""}`
                );
                // Small delay to show 100% before closing
                await new Promise((r) => setTimeout(r, 800));
                onComplete();
              } else if (event.type === "error") {
                toast.error(event.error || "Restore failed");
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } else {
        // Non-streaming fallback (e.g. error response)
        const data = await res.json();
        if (res.ok && data.success) {
          const countSummary = data.counts
            ? Object.entries(data.counts as Record<string, number>)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "";
          toast.success(
            `Restore complete${countSummary ? ` - ${countSummary}` : ""}`
          );
          onComplete();
        } else {
          toast.error(data.error || "Restore failed");
        }
      }
    } catch {
      toast.error("Network error - could not restore backup");
    } finally {
      setLoading(false);
      setConfirmation("");
      setProgress(0);
      setStatusMessage("");
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing during restore
    setConfirmation("");
    setProgress(0);
    setStatusMessage("");
    onClose();
  };

  const descriptionText = backup
    ? `Restore from backup created on ${format(new Date(backup.timestamp), "MMM d, yyyy 'at' HH:mm")}.`
    : file
      ? `Restore from uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => loading && e.preventDefault()}
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Restore Backup</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!loading && (
            <Alert variant="default" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                This is a <strong>full replacement restore</strong>. All
                existing students, marks, class groups, and settings will be{" "}
                <strong>deleted and replaced</strong> with data from the backup.
                User accounts will be merged (existing users are preserved).
              </AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="space-y-3">
              {/* Don't close warning */}
              <Alert variant="default" className="border-amber-200 bg-amber-50">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 font-medium">
                  Do not close this browser tab or this dialog while the restore
                  is in progress. Closing may result in partial data loss.
                </AlertDescription>
              </Alert>

              {/* Patience message */}
              <p className="text-sm text-muted-foreground text-center">
                This may take a few minutes depending on the amount of data
                being restored. Please be patient.
              </p>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{statusMessage}</span>
                  <span className="font-mono font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5" />
              </div>
            </div>
          )}

          {!loading && (
            <div className="space-y-2">
              <Label htmlFor="restore-confirm">
                Type <strong>RESTORE</strong> to confirm
              </Label>
              <Input
                id="restore-confirm"
                placeholder="RESTORE"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {!loading && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleRestore}
            disabled={!isConfirmed || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring… {progress}%
              </>
            ) : (
              "Confirm Restore"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
