"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";

export default function AcademicYearForm({
  initialValue,
}: {
  initialValue: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_year: value.trim() }),
      });
      if (res.ok) {
        toast.success("Academic year updated.");
        router.refresh();
      } else {
        toast.error("Failed to update academic year.");
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
        <CardTitle>Academic Year</CardTitle>
        <CardDescription>
          Changing the academic year affects mark entry defaults but does not
          alter any existing records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="academic-year">Year</Label>
          <Input
            id="academic-year"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="2025"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading || !value.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
