"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";

interface ManualBackupButtonProps {
  onComplete: () => void;
}

export default function ManualBackupButton({
  onComplete,
}: ManualBackupButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Backup failed");
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/gzip")) {
        // Local mode — trigger browser download
        const blob = await res.blob();
        const filename =
          res.headers
            .get("content-disposition")
            ?.match(/filename="(.+)"/)?.[1] ?? "schoolms-backup.json.gz";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(
          `Backup downloaded (${(blob.size / 1024).toFixed(1)} KB)`
        );
      } else {
        // Cloud mode — JSON response
        const data = await res.json();
        toast.success(
          `Backup created successfully (${(data.sizeBytes / 1024).toFixed(1)} KB)`
        );
      }

      onComplete();
    } catch {
      toast.error("Network error — could not create backup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleBackup} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <HardDriveDownload className="mr-2 h-4 w-4" />
      )}
      {loading ? "Backing up…" : "Back Up Now"}
    </Button>
  );
}
