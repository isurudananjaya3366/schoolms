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

export default function SchoolNameForm({
  initialValue,
  initialLogoUrl,
}: {
  initialValue: string;
  initialLogoUrl: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoError, setLogoError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_name: value.trim(), school_logo_url: logoUrl.trim() }),
      });
      if (res.ok) {
        toast.success("School name and logo updated.");
        router.refresh();
      } else {
        toast.error("Failed to update school name.");
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
        <CardTitle>School Name</CardTitle>
        <CardDescription>
          Displayed on the login page and in generated PDF reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="school-name">Name</Label>
          <Input
            id="school-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="SchoolMS"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="school-logo-url">Logo URL</Label>
          <Input
            id="school-logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setLogoError(false);
            }}
            placeholder="https://example.com/logo.png"
          />
          {logoUrl.trim() ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              {!logoError ? (
                <img
                  src={logoUrl.trim()}
                  alt="School logo preview"
                  className="h-16 w-16 rounded object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  Invalid
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {logoError ? "Could not load image from this URL" : "Logo preview"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No logo configured</p>
          )}
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
