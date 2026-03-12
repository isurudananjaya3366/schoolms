"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  CloudOff,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface BackupHistoryEntry {
  fileId: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  storageProvider: string;
  status: "success" | "failed";
  errorMessage?: string;
}

interface StatusBannerProps {
  latestBackup: BackupHistoryEntry | null;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function StatusBanner({
  latestBackup,
  onRefresh,
}: StatusBannerProps) {
  if (!latestBackup) {
    return (
      <Card className="border-muted">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-muted-foreground">
                No backups yet
              </p>
              <p className="text-sm text-muted-foreground">
                Create your first backup using the button above.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSuccess = latestBackup.status === "success";
  const timestamp = new Date(latestBackup.timestamp);

  return (
    <Card
      className={
        isSuccess
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <p
                className={`font-medium ${isSuccess ? "text-green-800" : "text-red-800"}`}
              >
                {isSuccess ? "Latest backup successful" : "Latest backup failed"}
              </p>
              <Badge
                variant={isSuccess ? "default" : "destructive"}
                className="text-xs"
              >
                {latestBackup.status}
              </Badge>
            </div>
            <div
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${isSuccess ? "text-green-700" : "text-red-700"}`}
            >
              <span>
                {format(timestamp, "MMM d, yyyy 'at' HH:mm")} (
                {formatDistanceToNow(timestamp, { addSuffix: true })})
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatBytes(latestBackup.sizeBytes)}
              </span>
              <span className="capitalize">
                {latestBackup.storageProvider}
              </span>
            </div>
            {latestBackup.errorMessage && (
              <p className="mt-1 text-sm text-red-600">
                Error: {latestBackup.errorMessage}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}
