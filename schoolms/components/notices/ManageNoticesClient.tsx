"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Archive,
  Loader2,
  Megaphone,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────

type NoticeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Notice {
  id: string;
  title: string;
  content: string;
  targetRoles: string[];
  status: NoticeStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface NoticeFormData {
  title: string;
  content: string;
  targetRoles: string[];
  expiresAt: string;
}

// ─── Constants ────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "ALL", label: "Everyone" },
  { value: "SUPERADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
  { value: "TEACHER", label: "Teacher" },
];

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const STATUS_BADGE: Record<NoticeStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

// ─── Helpers ──────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function getTargetLabel(roles: string[]): string {
  if (roles.includes("ALL") || roles.length === 0) return "Everyone";
  return roles
    .map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r)
    .join(", ");
}

// ─── Notice Form Modal ────────────────────────────────────

interface NoticeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Notice | null;
  onSave: (data: NoticeFormData) => Promise<void>;
  saving: boolean;
}

function NoticeFormModal({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: NoticeFormModalProps) {
  const [form, setForm] = useState<NoticeFormData>({
    title: "",
    content: "",
    targetRoles: ["ALL"],
    expiresAt: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        content: initial.content,
        targetRoles: initial.targetRoles,
        expiresAt: initial.expiresAt
          ? new Date(initial.expiresAt).toISOString().slice(0, 16)
          : "",
      });
    } else {
      setForm({ title: "", content: "", targetRoles: ["ALL"], expiresAt: "" });
    }
  }, [initial, open]);

  const handleTargetChange = (value: string) => {
    setForm((f) => ({ ...f, targetRoles: [value] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Notice" : "Create Notice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Notice title"
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notice-content">Content</Label>
            <Textarea
              id="notice-content"
              value={form.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="Write the notice content here..."
              rows={6}
              maxLength={5000}
              required
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {form.content.length}/5000
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="notice-target">Target Audience</Label>
              <Select
                value={form.targetRoles[0] ?? "ALL"}
                onValueChange={handleTargetChange}
              >
                <SelectTrigger id="notice-target">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notice-expires">Expires At (optional)</Label>
              <Input
                id="notice-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Save Changes" : "Create Notice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Client Component ────────────────────────────────

export default function ManageNoticesClient() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action loading state (publish/archive)
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchNotices = useCallback(async (filter: string) => {
    try {
      setLoading(true);
      setError(null);
      const url =
        filter === "ALL"
          ? "/api/notices"
          : `/api/notices?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load notices");
      const data: Notice[] = await res.json();
      setNotices(data);
    } catch {
      setError("Failed to load notices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices(statusFilter);
  }, [fetchNotices, statusFilter]);

  // Create or update
  const handleSave = async (formData: NoticeFormData) => {
    try {
      setSaving(true);
      const body = {
        title: formData.title,
        content: formData.content,
        targetRoles: formData.targetRoles,
        expiresAt: formData.expiresAt
          ? new Date(formData.expiresAt).toISOString()
          : null,
      };

      const res = editingNotice
        ? await fetch(`/api/notices/${editingNotice.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save notice");
      }

      setFormOpen(false);
      setEditingNotice(null);
      fetchNotices(statusFilter);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save notice");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (notice: Notice) => {
    try {
      setActionId(notice.id);
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      fetchNotices(statusFilter);
    } catch {
      alert("Failed to publish notice");
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (notice: Notice) => {
    try {
      setActionId(notice.id);
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      fetchNotices(statusFilter);
    } catch {
      alert("Failed to archive notice");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/notices/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteTarget(null);
      fetchNotices(statusFilter);
    } catch {
      alert("Failed to delete notice");
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditingNotice(null);
    setFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Notices</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage public notices for staff and students.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/notices" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Public Board
            </Link>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Notice
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => fetchNotices(statusFilter)}
          >
            Retry
          </Button>
        </div>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No notices found</p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first notice
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const isActioning = actionId === notice.id;
            return (
              <div
                key={notice.id}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {/* Left: content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_BADGE[notice.status]
                        }`}
                      >
                        {notice.status.charAt(0) +
                          notice.status.slice(1).toLowerCase()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {getTargetLabel(notice.targetRoles)}
                      </span>
                    </div>
                    <h3 className="font-semibold leading-snug">{notice.title}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {notice.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notice.publishedAt
                        ? `Published ${formatDate(notice.publishedAt)}`
                        : `Created ${formatDate(notice.createdAt)}`}{" "}
                      · by {notice.createdBy}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {notice.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePublish(notice)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Publish
                      </Button>
                    )}
                    {notice.status === "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchive(notice)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Archive className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Archive
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(notice)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(notice)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <NoticeFormModal
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingNotice(null);
        }}
        initial={editingNotice}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
