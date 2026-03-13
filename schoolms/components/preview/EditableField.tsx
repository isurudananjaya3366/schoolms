"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useEditLabels } from "./EditLabelsContext";
import type { SlideLabelKey } from "@/types/preview";
import { DEFAULT_SLIDE_LABELS } from "@/types/preview";

interface EditableFieldProps {
  /** The slide label key for this title */
  labelKey: SlideLabelKey;
  /** Optional suffix appended after the editable label (e.g. " — Class 10A") */
  suffix?: string;
  /** Additional classes applied to the outer element */
  className?: string;
}

/**
 * Renders a slide title. In editable mode (provided by EditLabelsContext),
 * clicking the title opens an inline input to edit the label.
 */
export default function EditableField({
  labelKey,
  suffix = "",
  className = "",
}: EditableFieldProps) {
  const { isEditable, labels, onLabelChange } = useEditLabels();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = labels[labelKey] ?? DEFAULT_SLIDE_LABELS[labelKey];

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!isEditable) {
    return (
      <span className={className}>
        {currentValue}
        {suffix}
      </span>
    );
  }

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={(e) => onLabelChange(labelKey, e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false);
          }}
          className="bg-transparent border-b-2 border-amber-400 outline-none min-w-0 w-auto max-w-full"
          style={{ width: `${Math.max(currentValue.length, 8)}ch` }}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  return (
    <span
      className={`group cursor-pointer inline-flex items-center gap-2 hover:text-amber-500 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Click to edit title"
    >
      {currentValue}
      {suffix}
      <Pencil className="size-4 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}
