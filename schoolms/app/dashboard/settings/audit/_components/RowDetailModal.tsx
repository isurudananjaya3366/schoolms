"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ACTION_LABELS } from "./action-labels";
import type { AuditEntry } from "./AuditLogViewer";

interface RowDetailModalProps {
  entry: AuditEntry | null;
  onClose: () => void;
}

function parseDetails(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function isMarkUpdateWithDiff(
  action: string,
  details: Record<string, unknown> | null
): details is Record<string, unknown> & { before: unknown; after: unknown } {
  return (
    action === "MARK_UPDATED" &&
    details !== null &&
    "before" in details &&
    "after" in details
  );
}

export default function RowDetailModal({ entry, onClose }: RowDetailModalProps) {
  if (!entry) return null;

  const details = parseDetails(entry.details);

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Log Entry</DialogTitle>
          <DialogDescription>
            {ACTION_LABELS[entry.action] ?? entry.action}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-y-2">
            <span className="font-medium text-muted-foreground">ID</span>
            <span className="font-mono text-xs break-all">{entry.id}</span>

            <span className="font-medium text-muted-foreground">Timestamp</span>
            <span>
              {format(new Date(entry.timestamp), "MMM dd, yyyy HH:mm:ss")}
              <span className="ml-2 text-xs text-muted-foreground">
                ({new Date(entry.timestamp).toISOString()})
              </span>
            </span>

            <span className="font-medium text-muted-foreground">User</span>
            <span>{entry.userDisplayName}</span>

            <span className="font-medium text-muted-foreground">Action</span>
            <span>
              <Badge variant="outline" className="text-xs font-normal">
                {entry.action}
              </Badge>
            </span>

            <span className="font-medium text-muted-foreground">
              Target Type
            </span>
            <span>{entry.targetType ?? "-"}</span>

            <span className="font-medium text-muted-foreground">Target ID</span>
            <span className="font-mono text-xs break-all">
              {entry.targetId ?? "-"}
            </span>

            <span className="font-medium text-muted-foreground">
              IP Address
            </span>
            <span>{entry.ipAddress ?? "-"}</span>
          </div>

          <Separator />

          <div>
            <span className="font-medium text-muted-foreground">Details</span>
            {isMarkUpdateWithDiff(entry.action, details) ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Before
                  </span>
                  <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(details.before, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    After
                  </span>
                  <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(details.after, null, 2)}
                  </pre>
                </div>
              </div>
            ) : details ? (
              <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(details, null, 2)}
              </pre>
            ) : (
              <p className="mt-2 text-muted-foreground">No details available</p>
            )}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
