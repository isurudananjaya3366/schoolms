"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import StatusBanner from "./StatusBanner";
import ManualBackupButton from "./ManualBackupButton";
import BackupHistoryTable from "./BackupHistoryTable";
import RestoreDialog from "./RestoreDialog";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function BackupDashboard() {
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState<BackupHistoryEntry | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/list");
      if (res.ok) setHistory(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (fileId: string) => {
    const res = await fetch(`/api/backup/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setHistory((prev) => prev.filter((h) => h.fileId !== fileId));
      toast.success("Backup deleted");
    } else {
      toast.error("Failed to delete backup");
    }
  };

  const handleBackupComplete = () => {
    fetchHistory();
  };

  const handleRestoreComplete = () => {
    setRestoreTarget(null);
    setRestoreFile(null);
    fetchHistory();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const latestBackup = history[0] || null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backup Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage database backups and restore operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".gz,.json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Restore from File
          </Button>
          <ManualBackupButton onComplete={handleBackupComplete} />
        </div>
      </div>

      <StatusBanner latestBackup={latestBackup} onRefresh={fetchHistory} />

      <BackupHistoryTable
        history={history}
        onDelete={handleDelete}
        onRestore={setRestoreTarget}
      />

      {/* Restore from cloud backup history entry */}
      <RestoreDialog
        backup={restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onComplete={handleRestoreComplete}
      />

      {/* Restore from uploaded file */}
      <RestoreDialog
        file={restoreFile}
        onClose={() => setRestoreFile(null)}
        onComplete={handleRestoreComplete}
      />
    </div>
  );
}
