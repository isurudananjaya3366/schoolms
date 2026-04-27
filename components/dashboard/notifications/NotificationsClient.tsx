"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, RefreshCw, AlertTriangle, Shield, Users, BookOpen, Calendar, HardDrive, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  targetRoles: string[];
  data: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  isRead: boolean;
}

interface ApiResponse {
  data: Notification[];
  unreadCount: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// Icon + colour per notification type
function getTypeStyle(type: string): { icon: React.ReactNode; color: string } {
  if (type.startsWith("STUDENT_")) return { icon: <Users className="size-4" />, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40" };
  if (type.startsWith("MARK_")) return { icon: <BookOpen className="size-4" />, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/40" };
  if (type.startsWith("MEETING_")) return { icon: <Calendar className="size-4" />, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" };
  if (type.startsWith("USER_")) return { icon: <Shield className="size-4" />, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40" };
  if (type.startsWith("BACKUP_") || type.startsWith("RESTORE_")) {
    const isFail = type.endsWith("_FAILED");
    return { icon: <HardDrive className="size-4" />, color: isFail ? "text-rose-500 bg-rose-50 dark:bg-rose-950/40" : "text-teal-500 bg-teal-50 dark:bg-teal-950/40" };
  }
  if (type === "SETTINGS_UPDATED") return { icon: <Settings className="size-4" />, color: "text-slate-500 bg-slate-50 dark:bg-slate-900/40" };
  return { icon: <Bell className="size-4" />, color: "text-slate-500 bg-slate-50 dark:bg-slate-900/40" };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async (pg: number, showUnreadOnly: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (showUnreadOnly) params.set("unread", "true");
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data: ApiResponse = await res.json();
      setNotifications(data.data);
      setUnreadCount(data.unreadCount);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(page, filter === "unread");
  }, [fetchNotifications, page, filter]);

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="default" className="rounded-full px-2 py-0.5 text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchNotifications(page, filter === "unread")}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={markAllRead}
              disabled={markingAll}
              className="gap-1.5"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b pb-1">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f
                ? "bg-accent font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="size-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const { icon, color } = getTypeStyle(n.type);
            return (
              <div
                key={n.id}
                className={`flex gap-3 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/50 ${
                  n.isRead ? "opacity-70" : "bg-background border-primary/20"
                }`}
                onClick={() => { if (!n.isRead) markAsRead(n.id); }}
              >
                {/* Icon */}
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                  {icon}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${n.isRead ? "text-muted-foreground" : ""}`}>
                      {n.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  {n.createdBy && (
                    <p className="text-xs text-muted-foreground/60 mt-1">by {n.createdBy}</p>
                  )}
                </div>

                {/* Unread dot */}
                {!n.isRead && (
                  <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
