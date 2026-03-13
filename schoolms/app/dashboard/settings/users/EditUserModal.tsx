"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["STAFF", "ADMIN", "TEACHER", "STUDENT"]),
});

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow;
  currentUserId: string;
  currentUserRole: string;
}

export default function EditUserModal({
  open,
  onOpenChange,
  user,
  currentUserId,
  currentUserRole,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSelf = user.id === currentUserId;
  const roles =
    currentUserRole === "SUPERADMIN" ? ["STAFF", "ADMIN", "TEACHER", "STUDENT"] : ["STAFF", "TEACHER", "STUDENT"];

  useEffect(() => {
    setForm({ name: user.name, email: user.email, role: user.role });
    setErrors({});
    setGeneralError("");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const p = issue.path.join(".");
        if (!errs[p]) errs[p] = issue.message;
      }
      setErrors(errs);
      return;
    }

    // Only send changed fields
    const payload: Record<string, string> = {};
    if (form.name !== user.name) payload.name = form.name;
    if (form.email !== user.email) payload.email = form.email;
    if (!isSelf && form.role !== user.role) payload.role = form.role;

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("User updated successfully.");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const data = await res.json();
      if (data.fields) setErrors(data.fields);
      setGeneralError(data.error || "Failed to update user.");
    } catch {
      setGeneralError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={loading} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eu-name">Name</Label>
              <Input
                id="eu-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(val) => update("role", val)}
                disabled={isSelf}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {{ STAFF: "Staff", ADMIN: "Admin", TEACHER: "Teacher", STUDENT: "Student" }[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-xs text-muted-foreground">
                  You cannot change your own role.
                </p>
              )}
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role}</p>
              )}
            </div>
          </fieldset>
          {generalError && (
            <p className="text-sm text-destructive">{generalError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
