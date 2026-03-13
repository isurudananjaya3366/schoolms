"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import {
  PERMISSION_FEATURES,
  CONFIGURABLE_ROLES,
  DEFAULT_PERMISSIONS,
  type PermissionKey,
  type AllRolePermissions,
  type ConfigurableRole,
} from "@/lib/permissions";

// Group features by their declared group field
const GROUPED = Object.entries(PERMISSION_FEATURES).reduce<
  Record<string, { key: PermissionKey; label: string; description: string }[]>
>((acc, [key, meta]) => {
  if (!acc[meta.group]) acc[meta.group] = [];
  acc[meta.group].push({ key: key as PermissionKey, label: meta.label, description: meta.description });
  return acc;
}, {});

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  TEACHER: "Teacher",
};

const ROLE_COLORS: Record<ConfigurableRole, string> = {
  ADMIN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  STAFF: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  TEACHER: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function PermissionsSettings() {
  const [permissions, setPermissions] = useState<AllRolePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPermissions(data.permissions);
    } catch {
      toast.error("Failed to load permissions. Showing defaults.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  function toggle(role: ConfigurableRole, key: PermissionKey) {
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setPermissions(data.permissions);
      toast.success("Permissions saved successfully.");
    } catch {
      toast.error("Failed to save permissions. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Role Permissions</CardTitle>
        </div>
        <CardDescription>
          Control what each role can access in the dashboard.
          SUPERADMIN always has full access and cannot be restricted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role header row */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-2/5 pb-3 text-left text-sm font-medium text-muted-foreground">
                  Feature
                </th>
                {CONFIGURABLE_ROLES.map((role) => (
                  <th key={role} className="pb-3 text-center">
                    <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(GROUPED).map(([group, features]) => (
                <>
                  <tr key={`group-${group}`}>
                    <td
                      colSpan={CONFIGURABLE_ROLES.length + 1}
                      className="py-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {group}
                    </td>
                  </tr>
                  {features.map(({ key, label, description }) => (
                    <tr key={key} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </td>
                      {CONFIGURABLE_ROLES.map((role) => (
                        <td key={`${role}-${key}`} className="py-3 text-center">
                          <Switch
                            checked={permissions[role][key]}
                            onCheckedChange={() => toggle(role, key)}
                            aria-label={`${ROLE_LABELS[role]} — ${label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Permissions
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
