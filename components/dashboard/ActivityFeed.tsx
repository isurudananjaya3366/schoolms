"use client";

import { formatDistanceToNow } from "date-fns";
import { formatAuditEntry } from "@/lib/formatAuditEntry";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLogEntry {
  id: string;
  timestamp: Date | string;
  userId: string | null;
  userDisplayName: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  ipAddress: string | null;
  details: string;
}

interface ActivityFeedProps {
  entries: AuditLogEntry[];
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No recent activity
      </p>
    );
  }

  return (
    <ScrollArea className="h-96">
      <ul className="space-y-3 pr-4">
        {entries.map((entry) => (
          <li key={entry.id} className="border-b pb-3 last:border-0">
            <p className="text-sm">{formatAuditEntry(entry as never)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(entry.timestamp), {
                addSuffix: true,
              })}
            </p>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
