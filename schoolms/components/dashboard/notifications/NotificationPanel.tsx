"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  Shield,
  Users,
  BookOpen,
  Calendar,
  HardDrive,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
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

function getTypeStyle(type: string): { icon: React.ReactNode; color: string } {
  if (type.startsWith("STUDENT_"))
    return { icon: <Users className="size-3.5" />, color: "text-blue-500 bg-blue-100 dark:bg-blue-950/50" };
  if (type.startsWith("MARK_"))
    return { icon: <BookOpen className="size-3.5" />, color: "text-violet-500 bg-violet-100 dark:bg-violet-950/50" };
  if (type.startsWith("MEETING_"))
    return { icon: <Calendar className="size-3.5" />, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-950/50" };
  if (type.startsWith("USER_"))
    return { icon: <Shield className="size-3.5" />, color: "text-amber-500 bg-amber-100 dark:bg-amber-950/50" };
  if (type.startsWith("BACKUP_") || type.startsWith("RESTORE_")) {
    const isFail = type.endsWith("_FAILED");
    return {
      icon: <HardDrive className="size-3.5" />,
      color: isFail
        ? "text-rose-500 bg-rose-100 dark:bg-rose-950/50"
        : "text-teal-500 bg-teal-100 dark:bg-teal-950/50",
    };
  }
  if (type === "SETTINGS_UPDATED")
    return { icon: <Settings className="size-3.5" />, color: "text-slate-500 bg-slate-100 dark:bg-slate-800/50" };
  return { icon: <Bell className="size-3.5" />, color: "text-slate-500 bg-slate-100 dark:bg-slate-800/50" };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface NotificationPanelProps {
  role: string;
}

export default function NotificationPanel({ role }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Students don't get notifications
  const enabled = role !== "STUDENT";

  const fetchNotifications = useCallback(
    async (pg: number, showUnreadOnly: boolean) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(pg), limit: "20" });
        if (showUnreadOnly) params.set("unread", "true");
        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) throw new Error();
        const data: ApiResponse = await res.json();
        setNotifications(data.data);
        setUnreadCount(data.unreadCount);
        setTotalPages(data.pagination.totalPages);
      } catch {
        setError("Could not load notifications.");
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  // Fetch unread count on mount and when panel closes (side-effect: keep badge updated)
  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setUnreadCount(data.unreadCount);
    } catch {
      /* silent */
    }
  }, [enabled]);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 60_000); // poll every minute
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // Load notifications when panel opens
  useEffect(() => {
    if (open) fetchNotifications(page, filter === "unread");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFilterChange = (f: "all" | "unread") => {
    setFilter(f);
    setPage(1);
    fetchNotifications(1, f === "unread");
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchNotifications(p, filter === "unread");
  };

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

  if (!enabled) return null;

  return (
    <>
      {/* Bell button with badge */}
      <Button
        variant="ghost"
        size="icon"
        title="Notifications"
        className="relative"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l bg-background shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="default" className="rounded-full px-1.5 py-0 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllRead}
                disabled={markingAll}
                className="h-7 gap-1 text-xs"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => fetchNotifications(page, filter === "unread")}
            >
              <RefreshCw className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b px-4 py-1.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                filter === f
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : "Unread"}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="flex items-center gap-2 m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Bell className="size-8 text-muted-foreground mb-2 opacity-30" />
              <p className="text-muted-foreground text-xs">
                {filter === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const { icon, color } = getTypeStyle(n.type);
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors ${
                      n.isRead ? "opacity-60" : ""
                    }`}
                    onClick={() => { if (!n.isRead) markAsRead(n.id); }}
                  >
                    {/* Type icon */}
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${color}`}
                    >
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-medium leading-snug ${n.isRead ? "text-muted-foreground" : ""}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      {n.createdBy && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          by {n.createdBy}
                        </p>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {!n.isRead && (
                      <div className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
