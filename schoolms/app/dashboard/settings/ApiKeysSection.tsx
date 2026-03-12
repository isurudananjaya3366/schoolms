"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Gauge,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Construction,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface KeyMeta {
  key: string;
  label: string;
  group: string;
  description: string;
  isSensitive: boolean;
  hasDbValue: boolean;
  hasEnvFallback: boolean;
}

// Map group names to icons
const GROUP_ICONS: Record<string, React.ReactNode> = {
  Email: <Mail className="h-5 w-5" />,
  "Rate Limiting": <Gauge className="h-5 w-5" />,
};

// Groups disabled with "Coming Soon" overlay
const COMING_SOON_GROUPS = new Set(["Rate Limiting"]);

// ─── Component ───────────────────────────────────────────

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // group being saved
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Fetch key metadata on mount
  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/secure");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setKeys(data.keys);
    } catch {
      toast.error("Failed to load API key settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Group keys by their group name
  const groups = keys.reduce<Record<string, KeyMeta[]>>((acc, k) => {
    (acc[k.group] ??= []).push(k);
    return acc;
  }, {});

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Save all keys in a group
  const saveGroup = async (group: string) => {
    const groupKeys = groups[group];
    if (!groupKeys) return;

    // Collect only the values that were actually changed
    const payload: Record<string, string> = {};
    for (const k of groupKeys) {
      if (values[k.key] !== undefined) {
        payload[k.key] = values[k.key];
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    setSaving(group);
    try {
      const res = await fetch("/api/settings/secure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }

      const data = await res.json();
      toast.success(
        `Saved ${data.updatedKeys?.length ?? 0} key(s) in ${group}.`
      );

      // Clear changed values and refresh metadata
      setValues((prev) => {
        const next = { ...prev };
        for (const k of groupKeys) delete next[k.key];
        return next;
      });
      setRevealed(new Set());
      await fetchKeys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings."
      );
    } finally {
      setSaving(null);
    }
  };

  // Delete (clear) a single key from DB
  const deleteKey = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/settings/secure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: "" }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Key removed from database.");
      setValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchKeys();
    } catch {
      toast.error("Failed to remove key.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Keys & Integrations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const groupOrder = ["Email", "Rate Limiting"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          API Keys & Integrations
        </CardTitle>
        <CardDescription>
          Manage external service credentials. All values are{" "}
          <strong>AES-256-GCM encrypted</strong> before storage. Keys stored in
          the <code>.env</code> file (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL)
          are not managed here.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {groupOrder.map((groupName) => {
          const groupKeys = groups[groupName];
          if (!groupKeys?.length) return null;

          const isComingSoon = COMING_SOON_GROUPS.has(groupName);
          const hasChanges = groupKeys.some(
            (k) => values[k.key] !== undefined
          );
          const isSavingGroup = saving === groupName;

          return (
            <div
              key={groupName}
              className={`rounded-lg border p-4 space-y-4 ${
                isComingSoon ? "opacity-60 pointer-events-none select-none" : ""
              }`}
            >
              {/* Group header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {GROUP_ICONS[groupName] ?? <ShieldCheck className="h-5 w-5" />}
                  {groupName}
                  {isComingSoon && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <Construction className="h-3 w-3" />
                      Coming Soon
                    </span>
                  )}
                </div>
                {!isComingSoon && (
                  <Button
                    size="sm"
                    disabled={!hasChanges || !!saving}
                    onClick={() => saveGroup(groupName)}
                  >
                    {isSavingGroup ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>

              {/* Coming Soon description */}
              {isComingSoon && (
                <p className="text-sm text-muted-foreground">
                  Rate limiting integration will be available in a future update.
                </p>
              )}

              {/* Keys */}
              {!isComingSoon && groupKeys.map((meta) => {
                const isRevealed = revealed.has(meta.key);
                const currentInput = values[meta.key] ?? "";
                const isDeleting = saving === meta.key;

                return (
                  <div key={meta.key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`secure-${meta.key}`}
                        className="text-sm font-medium"
                      >
                        {meta.label}
                      </Label>

                      {/* Status badge */}
                      {meta.hasDbValue ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" />
                          Stored
                        </span>
                      ) : meta.hasEnvFallback ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          <AlertCircle className="h-3 w-3" />
                          .env fallback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Not set
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`secure-${meta.key}`}
                          type={
                            meta.isSensitive && !isRevealed
                              ? "password"
                              : "text"
                          }
                          value={currentInput}
                          onChange={(e) =>
                            handleChange(meta.key, e.target.value)
                          }
                          placeholder={
                            meta.hasDbValue
                              ? "••••••••  (change value)"
                              : "Enter value…"
                          }
                          autoComplete="off"
                        />
                      </div>

                      {meta.isSensitive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="shrink-0"
                          onClick={() => toggleReveal(meta.key)}
                          title={isRevealed ? "Hide" : "Reveal"}
                        >
                          {isRevealed ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {meta.hasDbValue && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => deleteKey(meta.key)}
                          disabled={!!saving}
                          title="Remove from database"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
