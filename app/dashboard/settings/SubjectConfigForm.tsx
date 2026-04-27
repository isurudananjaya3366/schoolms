"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, X } from "lucide-react";

const CORE_SUBJECT_KEYS = [
  "sinhala",
  "buddhism",
  "maths",
  "science",
  "english",
  "history",
] as const;

interface Props {
  initialCoreSubjects: Record<string, string>;
  initialSubjectsI: string[];
  initialSubjectsII: string[];
  initialSubjectsIII: string[];
}

function SubjectCategory({
  label,
  subjects,
  onAdd,
  onRemove,
  onEdit,
}: {
  label: string;
  subjects: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number, value: string) => void;
}) {
  const [input, setInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (subjects.includes(trimmed)) {
      toast.error("Subject already exists in this category.");
      return;
    }
    onAdd(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(subjects[index]);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingIndex(null);
      return;
    }
    if (subjects.some((s, i) => i !== editingIndex && s === trimmed)) {
      toast.error("Subject already exists in this category.");
      return;
    }
    onEdit(editingIndex, trimmed);
    setEditingIndex(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {subjects.map((subject, i) =>
          editingIndex === i ? (
            <Input
              key={i}
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              className="h-7 w-40 text-xs"
            />
          ) : (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1 hover:bg-secondary/80"
              onClick={() => startEdit(i)}
            >
              {subject}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add subject…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={handleAdd}
          disabled={!input.trim()}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

export default function SubjectConfigForm({
  initialCoreSubjects,
  initialSubjectsI,
  initialSubjectsII,
  initialSubjectsIII,
}: Props) {
  const router = useRouter();
  const [coreSubjects, setCoreSubjects] =
    useState<Record<string, string>>(initialCoreSubjects);
  const [subjectsI, setSubjectsI] = useState<string[]>(initialSubjectsI);
  const [subjectsII, setSubjectsII] = useState<string[]>(initialSubjectsII);
  const [subjectsIII, setSubjectsIII] = useState<string[]>(initialSubjectsIII);
  const [loading, setLoading] = useState(false);

  const updateCoreName = (key: string, displayName: string) => {
    setCoreSubjects((prev) => ({ ...prev, [key]: displayName }));
  };

  const makeHandlers = (
    subjects: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => ({
    onAdd: (v: string) => setter([...subjects, v]),
    onRemove: (i: number) => setter(subjects.filter((_, idx) => idx !== i)),
    onEdit: (i: number, v: string) =>
      setter(subjects.map((s, idx) => (idx === i ? v : s))),
  });

  const handleSave = async () => {
    // Validate core subject display names are non-empty
    for (const key of CORE_SUBJECT_KEYS) {
      if (!coreSubjects[key]?.trim()) {
        toast.error(`Display name for "${key}" cannot be empty.`);
        return;
      }
    }

    if (
      subjectsI.length === 0 &&
      subjectsII.length === 0 &&
      subjectsIII.length === 0
    ) {
      toast.error("Each category should have at least one subject.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core_subjects: JSON.stringify(coreSubjects),
          elective_label_I: JSON.stringify(subjectsI),
          elective_label_II: JSON.stringify(subjectsII),
          elective_label_III: JSON.stringify(subjectsIII),
        }),
      });
      if (res.ok) {
        toast.success("Subject configuration updated.");
        router.refresh();
      } else {
        toast.error("Failed to update subject configuration.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Configuration</CardTitle>
        <CardDescription>
          Configure display names for core subjects and manage elective category
          subjects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Core Subjects */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Core Subjects</Label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_SUBJECT_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <Label
                  htmlFor={`core-${key}`}
                  className="text-xs text-muted-foreground"
                >
                  {key}
                </Label>
                <Input
                  id={`core-${key}`}
                  value={coreSubjects[key] || ""}
                  onChange={(e) => updateCoreName(key, e.target.value)}
                  placeholder={key}
                  className="h-9"
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Elective Categories */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            Elective Category Subjects
          </Label>
          <div className="grid gap-5 sm:grid-cols-3">
            <SubjectCategory
              label="Category I"
              subjects={subjectsI}
              {...makeHandlers(subjectsI, setSubjectsI)}
            />
            <SubjectCategory
              label="Category II"
              subjects={subjectsII}
              {...makeHandlers(subjectsII, setSubjectsII)}
            />
            <SubjectCategory
              label="Category III"
              subjects={subjectsIII}
              {...makeHandlers(subjectsIII, setSubjectsIII)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
