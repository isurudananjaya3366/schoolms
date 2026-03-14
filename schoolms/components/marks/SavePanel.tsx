"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Save, SendHorizonal } from "lucide-react";

interface SavePanelProps {
  dirtyCount: number;
  saving: boolean;
  hasInvalidRows: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function SavePanel({
  dirtyCount,
  saving,
  hasInvalidRows,
  onSaveDraft,
  onPublish,
}: SavePanelProps) {
  const disabled = dirtyCount === 0 || saving || hasInvalidRows;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Button
        variant="outline"
        onClick={onSaveDraft}
        disabled={disabled}
        aria-busy={saving}
        aria-disabled={disabled}
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {saving ? "Saving…" : "Save as Draft"}
      </Button>

      <Button
        onClick={onPublish}
        disabled={disabled}
        aria-busy={saving}
        aria-disabled={disabled}
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <SendHorizonal className="mr-2 h-4 w-4" />
        )}
        {saving ? "Publishing…" : "Publish"}
      </Button>

      {dirtyCount > 0 && (
        <span className="text-sm text-muted-foreground">
          {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
        </span>
      )}
      {hasInvalidRows && (
        <span className="text-sm text-red-500">
          Fix invalid entries before saving
        </span>
      )}
    </div>
  );
}
