"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, RotateCcw, Trash2, DatabaseBackup } from "lucide-react";
import { format } from "date-fns";

interface BackupHistoryEntry {
  fileId: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  storageProvider: string;
  status: "success" | "failed";
  errorMessage?: string;
}

interface BackupHistoryTableProps {
  history: BackupHistoryEntry[];
  onDelete: (fileId: string) => void;
  onRestore: (entry: BackupHistoryEntry) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupHistoryTable({
  history,
  onDelete,
  onRestore,
}: BackupHistoryTableProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <DatabaseBackup className="mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-medium">No backups found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first backup to see it listed here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time (UTC)</TableHead>
            <TableHead>File Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => {
            const ts = new Date(entry.timestamp);
            return (
              <TableRow key={entry.fileId}>
                <TableCell>{format(ts, "MMM d, yyyy")}</TableCell>
                <TableCell>{format(ts, "HH:mm:ss")}</TableCell>
                <TableCell>{formatBytes(entry.sizeBytes)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      entry.status === "success" ? "default" : "destructive"
                    }
                  >
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">
                  {entry.storageProvider}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {entry.status === "success" && (
                      <>
                        {entry.storageProvider !== "local" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  // For Vercel Blob, fileId is the URL itself
                                  window.open(entry.fileId, "_blank");
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onRestore(entry)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restore</TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the backup from{" "}
                            {format(ts, "MMM d, yyyy 'at' HH:mm")}. This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(entry.fileId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
