"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Loader2,
  PenLine,
  Upload,
  Trash2,
  UserCircle,
  GraduationCap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface Signature {
  key: string;
  label: string;
  url: string;
  type: "class_teacher" | "principal" | "vice_principal";
  classLabel: string | null;
}

interface ClassGroup {
  id: string;
  grade: number;
  section: string;
}

// ─── Component ───────────────────────────────────────────

export default function SignatureManagementSection() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");

  const classTeacherFileRef = useRef<HTMLInputElement>(null);
  const principalFileRef = useRef<HTMLInputElement>(null);
  const vicePrincipalFileRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [sigRes, classRes] = await Promise.all([
        fetch("/api/uploads/signature"),
        fetch("/api/class-groups"),
      ]);

      if (sigRes.ok) {
        const data = await sigRes.json();
        setSignatures(data.signatures || []);
      }

      if (classRes.ok) {
        const data = await classRes.json();
        const groups: ClassGroup[] = (data.data || data || []).sort(
          (a: ClassGroup, b: ClassGroup) =>
            a.grade - b.grade || a.section.localeCompare(b.section)
        );
        setClassGroups(groups);
        if (!selectedClass && groups.length > 0) {
          setSelectedClass(`${groups[0].grade}${groups[0].section}`);
        }
      }
    } catch {
      toast.error("Failed to load signature data.");
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Upload handler
  const handleUpload = async (
    file: File,
    type: "class_teacher" | "principal" | "vice_principal",
    classLabel?: string
  ) => {
    const uploadKey = type === "class_teacher" ? `class_${classLabel}` : type;
    setUploading(uploadKey);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      if (classLabel) formData.append("classLabel", classLabel);

      const res = await fetch("/api/uploads/signature", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Upload failed");
      }

      toast.success(
        type === "class_teacher"
          ? `Class ${classLabel} teacher signature uploaded.`
          : `${type === "principal" ? "Principal" : "Vice Principal"} signature uploaded.`
      );
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload signature."
      );
    } finally {
      setUploading(null);
    }
  };

  // Delete handler
  const handleDelete = async (key: string) => {
    setUploading(key);
    try {
      const res = await fetch("/api/uploads/signature", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Signature removed.");
      await fetchData();
    } catch {
      toast.error("Failed to delete signature.");
    } finally {
      setUploading(null);
    }
  };

  // File change handlers
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "class_teacher" | "principal" | "vice_principal",
    classLabel?: string
  ) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, type, classLabel);
    e.target.value = "";
  };

  // Find existing signature
  const findSignature = (type: string, classLabel?: string) => {
    return signatures.find(
      (s) =>
        s.type === type &&
        (classLabel ? s.classLabel === classLabel : true)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Digital Signatures</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const classTeacherSig = findSignature("class_teacher", selectedClass);
  const principalSig = findSignature("principal");
  const vicePrincipalSig = findSignature("vice_principal");

  // All class labels that have signatures
  const classesWithSigs = signatures
    .filter((s) => s.type === "class_teacher" && s.classLabel)
    .map((s) => s.classLabel!);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenLine className="h-5 w-5" />
          Digital Signatures
        </CardTitle>
        <CardDescription>
          Upload signature images for class teachers, principal, and vice
          principal. These will appear on generated progress reports. Requires{" "}
          <strong>Blob Storage</strong> to be configured in API Keys.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ─── Class Teacher Signatures ─── */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <GraduationCap className="h-5 w-5" />
            Class Teacher Signatures
          </div>

          {/* Class grid selector */}
          <div className="space-y-1.5">
            <Label>Select Class</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {classGroups.map((cg) => {
                const label = `${cg.grade}${cg.section}`;
                const isSelected = selectedClass === label;
                const hasSig = classesWithSigs.includes(label);
                return (
                  <button
                    key={cg.id}
                    type="button"
                    onClick={() => setSelectedClass(label)}
                    className={cn(
                      "relative rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {label}
                    {hasSig && !isSelected && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Upload button */}
            <div>
              <input
                ref={classTeacherFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleFileChange(e, "class_teacher", selectedClass)
                }
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedClass || !!uploading}
                onClick={() => classTeacherFileRef.current?.click()}
              >
                {uploading === `class_${selectedClass}` ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload Signature
              </Button>
            </div>

            {/* Delete button */}
            {classTeacherSig && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={!!uploading}
                onClick={() => handleDelete(classTeacherSig.key)}
              >
                {uploading === classTeacherSig.key ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Remove
              </Button>
            )}
          </div>

          {/* Preview */}
          {classTeacherSig ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <img
                src={classTeacherSig.url}
                alt={`${selectedClass} teacher signature`}
                className="h-16 max-w-[200px] object-contain"
              />
              <span className="text-sm text-muted-foreground">
                {classTeacherSig.label}
              </span>
            </div>
          ) : selectedClass ? (
            <p className="text-xs text-muted-foreground">
              No signature uploaded for class {selectedClass} teacher.
            </p>
          ) : null}

          {/* Quick overview of all uploaded class signatures */}
          {classesWithSigs.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Uploaded:</span>{" "}
              {classesWithSigs.sort().join(", ")}
            </div>
          )}
        </div>

        {/* ─── Principal & Vice Principal ─── */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <UserCircle className="h-5 w-5" />
            Administration Signatures
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Principal */}
            <div className="space-y-2">
              <Label>Principal</Label>
              <input
                ref={principalFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "principal")}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!uploading}
                  onClick={() => principalFileRef.current?.click()}
                >
                  {uploading === "principal" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Upload
                </Button>
                {principalSig && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={!!uploading}
                    onClick={() => handleDelete(principalSig.key)}
                  >
                    {uploading === principalSig.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {principalSig ? (
                <div className="rounded-md border p-2">
                  <img
                    src={principalSig.url}
                    alt="Principal signature"
                    className="h-14 max-w-[180px] object-contain"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Not uploaded</p>
              )}
            </div>

            {/* Vice Principal */}
            <div className="space-y-2">
              <Label>Vice Principal</Label>
              <input
                ref={vicePrincipalFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "vice_principal")}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!uploading}
                  onClick={() => vicePrincipalFileRef.current?.click()}
                >
                  {uploading === "vice_principal" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Upload
                </Button>
                {vicePrincipalSig && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={!!uploading}
                    onClick={() => handleDelete(vicePrincipalSig.key)}
                  >
                    {uploading === vicePrincipalSig.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {vicePrincipalSig ? (
                <div className="rounded-md border p-2">
                  <img
                    src={vicePrincipalSig.url}
                    alt="Vice Principal signature"
                    className="h-14 max-w-[180px] object-contain"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Not uploaded</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
