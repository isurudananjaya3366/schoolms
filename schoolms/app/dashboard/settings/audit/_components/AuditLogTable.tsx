"use client";

import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { ACTION_LABELS } from "./action-labels";
import type { AuditEntry } from "./AuditLogViewer";

interface AuditLogTableProps {
  data: AuditEntry[];
  onRowClick: (entry: AuditEntry) => void;
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

export default function AuditLogTable({ data, onRowClick }: AuditLogTableProps) {
  if (data.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead className="w-10">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer"
              onClick={() => onRowClick(entry)}
            >
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      {format(
                        new Date(entry.timestamp),
                        "MMM dd, yyyy HH:mm:ss"
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {new Date(entry.timestamp).toISOString()}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>{entry.userDisplayName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs font-normal">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.targetType ? (
                  <>
                    {entry.targetType}
                    {entry.targetId && (
                      <>: {truncate(entry.targetId, 12)}</>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.ipAddress ?? "—"}
              </TableCell>
              <TableCell>
                {entry.details && entry.details !== "{}" && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </TooltipProvider>
  );
}
