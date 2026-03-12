"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ElectiveCategory {
  label: string;
  subjects: string[];
}

interface StudentFormProps {
  mode: "create" | "edit";
  student?: {
    id: string;
    name: string;
    indexNumber: string;
    classId: string;
    electives: { categoryI: string; categoryII: string; categoryIII: string };
    scholarshipMarks?: number;
  };
  availableClasses: { id: string; grade: number; section: string }[];
  electiveOptions: {
    categoryI: ElectiveCategory;
    categoryII: ElectiveCategory;
    categoryIII: ElectiveCategory;
  };
  onStudentAdded?: () => void;
}

const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100),
  indexNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,20}$/, "Must be 2-20 alphanumeric characters")
    .optional()
    .or(z.literal("")),
  classId: z.string().min(1, "Please select a class"),
  categoryI: z.string().optional().or(z.literal("")),
  categoryII: z.string().optional().or(z.literal("")),
  categoryIII: z.string().optional().or(z.literal("")),
  scholarshipMarks: z.number({ required_error: "Scholarship marks is required" }).int().min(0, "Must be 0 or above").max(200, "Maximum is 200"),
});

export default function StudentForm({
  mode,
  student,
  availableClasses,
  electiveOptions,
  onStudentAdded,
}: StudentFormProps) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Determine initial grade from student's classId
  const initialClass = student
    ? availableClasses.find((c) => c.id === student.classId)
    : null;

  const [formData, setFormData] = useState({
    name: student?.name || "",
    indexNumber: student?.indexNumber || "",
    classId: student?.classId || "",
    categoryI: student?.electives.categoryI || "",
    categoryII: student?.electives.categoryII || "",
    categoryIII: student?.electives.categoryIII || "",
    scholarshipMarks: student?.scholarshipMarks?.toString() ?? "",
  });

  const [selectedGrade, setSelectedGrade] = useState<number | null>(
    initialClass?.grade ?? null
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [indexCheckStatus, setIndexCheckStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Get unique grades
  const grades = [...new Set(availableClasses.map((c) => c.grade))].sort();

  // Filter sections by selected grade
  const filteredSections = selectedGrade
    ? availableClasses.filter((c) => c.grade === selectedGrade)
    : [];

  // Grade change handler
  const handleGradeChange = (value: string) => {
    const grade = parseInt(value);
    setSelectedGrade(grade);
    setFormData((prev) => ({ ...prev, classId: "" }));
    setFieldErrors((prev) => {
      const { classId: _, ...rest } = prev;
      return rest;
    });
  };

  // Index number availability check
  useEffect(() => {
    if (!formData.indexNumber.trim()) {
      setIndexCheckStatus("idle");
      return;
    }
    if (mode === "edit" && formData.indexNumber === student?.indexNumber) {
      setIndexCheckStatus("idle");
      return;
    }

    setIndexCheckStatus("idle");
    const timer = setTimeout(async () => {
      if (isSubmitting) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIndexCheckStatus("checking");
      try {
        const res = await fetch(
          `/api/students?search=${encodeURIComponent(formData.indexNumber.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setIndexCheckStatus("idle");
          return;
        }
        const data = await res.json();
        const students = data.data || [];
        const match = students.find(
          (s: { indexNumber: string; id: string }) =>
            s.indexNumber.toLowerCase() ===
              formData.indexNumber.trim().toLowerCase() &&
            (mode === "create" || s.id !== student?.id)
        );
        setIndexCheckStatus(match ? "taken" : "available");
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") setIndexCheckStatus("idle");
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [formData.indexNumber, isSubmitting, mode, student?.indexNumber, student?.id]);

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError("");

    const parsed = clientSchema.safeParse({
      ...formData,
      scholarshipMarks: formData.scholarshipMarks !== ""
        ? parseInt(formData.scholarshipMarks, 10)
        : undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!errors[path]) errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint =
        mode === "create" ? "/api/students" : `/api/students/${student!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const payload = {
        name: formData.name.trim(),
        indexNumber: formData.indexNumber.trim() || null,
        classId: formData.classId,
        electives: {
          categoryI: formData.categoryI.trim(),
          categoryII: formData.categoryII.trim(),
          categoryIII: formData.categoryIII.trim(),
        },
        scholarshipMarks: parseInt(formData.scholarshipMarks, 10),
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 400) {
        const data = await res.json();
        if (data.fields) {
          setFieldErrors(data.fields);
        }
        setGeneralError(data.error || "Validation failed");
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setGeneralError("You do not have permission to perform this action.");
        return;
      }

      if (!res.ok) {
        setGeneralError("An unexpected error occurred. Please try again.");
        return;
      }

      const returnedStudent = await res.json();

      if (mode === "create") {
        // Rapid entry: clear form and stay on page
        setFormData({
          name: "",
          indexNumber: "",
          classId: "",
          categoryI: "",
          categoryII: "",
          categoryIII: "",
          scholarshipMarks: "",
        });
        setSelectedGrade(null);
        setIndexCheckStatus("idle");
        setFieldErrors({});
        setGeneralError("");
        toast.success("Student added successfully! Form cleared for next entry.");
        onStudentAdded?.();
        setTimeout(() => nameInputRef.current?.focus(), 0);
      } else {
        router.push(`/dashboard/students/${returnedStudent.id}`);
      }
    } catch {
      setGeneralError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {generalError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isSubmitting} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                ref={nameInputRef}
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Student full name"
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            {/* Index Number */}
            <div className="space-y-2">
              <Label htmlFor="indexNumber">Index Number</Label>
              <Input
                id="indexNumber"
                value={formData.indexNumber}
                onChange={(e) => updateField("indexNumber", e.target.value)}
                placeholder="e.g. STU001"
              />
              {indexCheckStatus === "checking" && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking
                  availability…
                </p>
              )}
              {indexCheckStatus === "available" && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-3 w-3" /> Available
                </p>
              )}
              {indexCheckStatus === "taken" && (
                <p className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Index number already in
                  use
                </p>
              )}
              {fieldErrors.indexNumber && (
                <p className="text-sm text-destructive">
                  {fieldErrors.indexNumber}
                </p>
              )}
            </div>

            {/* Scholarship Exam Marks */}
            <div className="space-y-2">
              <Label htmlFor="scholarshipMarks">Scholarship Exam Marks</Label>
              <Input
                id="scholarshipMarks"
                type="number"
                min={0}
                max={200}
                value={formData.scholarshipMarks}
                onChange={(e) => updateField("scholarshipMarks", e.target.value)}
                placeholder="Required (0–200)"
              />
              {fieldErrors.scholarshipMarks && (
                <p className="text-sm text-destructive">
                  {fieldErrors.scholarshipMarks}
                </p>
              )}
            </div>

            {/* Grade */}
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select
                value={selectedGrade?.toString() || ""}
                onValueChange={handleGradeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g.toString()}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class Section */}
            <div className="space-y-2">
              <Label>Class Section</Label>
              <Select
                value={formData.classId}
                onValueChange={(val) => updateField("classId", val)}
                disabled={!selectedGrade}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedGrade ? "Select section" : "Select grade first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredSections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade}
                      {c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.classId && (
                <p className="text-sm text-destructive">
                  {fieldErrors.classId}
                </p>
              )}
            </div>

            {/* Electives */}
            <div className="space-y-2">
              <Label>{electiveOptions.categoryI.label}</Label>
              <Select
                value={formData.categoryI}
                onValueChange={(val) => updateField("categoryI", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {electiveOptions.categoryI.subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors["electives.categoryI"] && (
                <p className="text-sm text-destructive">
                  {fieldErrors["electives.categoryI"]}
                </p>
              )}
              {fieldErrors.categoryI && (
                <p className="text-sm text-destructive">
                  {fieldErrors.categoryI}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{electiveOptions.categoryII.label}</Label>
              <Select
                value={formData.categoryII}
                onValueChange={(val) => updateField("categoryII", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {electiveOptions.categoryII.subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors["electives.categoryII"] && (
                <p className="text-sm text-destructive">
                  {fieldErrors["electives.categoryII"]}
                </p>
              )}
              {fieldErrors.categoryII && (
                <p className="text-sm text-destructive">
                  {fieldErrors.categoryII}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{electiveOptions.categoryIII.label}</Label>
              <Select
                value={formData.categoryIII}
                onValueChange={(val) => updateField("categoryIII", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {electiveOptions.categoryIII.subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors["electives.categoryIII"] && (
                <p className="text-sm text-destructive">
                  {fieldErrors["electives.categoryIII"]}
                </p>
              )}
              {fieldErrors.categoryIII && (
                <p className="text-sm text-destructive">
                  {fieldErrors.categoryIII}
                </p>
              )}
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "create"
                ? isSubmitting
                  ? "Adding Student…"
                  : "Add Student"
                : isSubmitting
                  ? "Saving…"
                  : "Save Changes"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard/students">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
