"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useEditLabels } from "./EditLabelsContext";
import type { SlideLabelKey } from "@/types/preview";
import { DEFAULT_SLIDE_LABELS } from "@/types/preview";

type Segment =
  | { type: "static"; text: string }
  | { type: "variable"; name: string };

function parseSegments(template: string): Segment[] {
  return template
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^\{([^}]+)\}$/);
      return m
        ? { type: "variable" as const, name: m[1] }
        : { type: "static" as const, text: part };
    });
}

function hasVariables(template: string): boolean {
  return /\{[^}]+\}/.test(template);
}

interface EditableFieldProps {
  /** The slide label key for this title */
  labelKey: SlideLabelKey;
  /** Optional suffix appended after the editable label (e.g. " - Class 10A") */
  suffix?: string;
  /** Additional classes applied to the outer element */
  className?: string;
  /** Runtime values to substitute {variable} tokens when rendering (view mode only) */
  variables?: Record<string, string>;
}

/**
 * Renders a slide label. In editable mode (provided by EditLabelsContext),
 * clicking opens an inline input. Segments wrapped in {braces} are treated
 * as runtime variables - protected from editing and substituted in view mode.
 */
export default function EditableField({
  labelKey,
  suffix = "",
  className = "",
  variables = {},
}: EditableFieldProps) {
  const { isEditable, labels, onLabelChange } = useEditLabels();
  const [editing, setEditing] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const currentValue = labels[labelKey] ?? DEFAULT_SLIDE_LABELS[labelKey];
  const isTemplated = hasVariables(currentValue);

  useEffect(() => {
    if (editing && firstInputRef.current) {
      firstInputRef.current.focus();
      firstInputRef.current.select();
    }
  }, [editing]);

  // ── Non-editable view mode ────────────────────────────────────────────
  if (!isEditable) {
    const displayValue = currentValue.replace(
      /\{([^}]+)\}/g,
      (_, name: string) => variables[name] ?? `{${name}}`
    );
    return (
      <span className={className}>
        {displayValue}
        {suffix}
      </span>
    );
  }

  // ── Edit mode: no variables → single inline input (original behavior) ─
  if (!isTemplated) {
    if (editing) {
      return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
          <input
            ref={firstInputRef}
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
        title="Click to edit"
      >
        {currentValue}
        {suffix}
        <Pencil className="size-4 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      </span>
    );
  }

  // ── Edit mode: has variables → segmented editor ───────────────────────
  const segments = parseSegments(currentValue);

  const handleSegmentChange = (segIdx: number, newText: string) => {
    const newSegments = segments.map((s, i) =>
      i === segIdx ? { ...s, text: newText } : s
    );
    const newValue = newSegments
      .map((s) => (s.type === "variable" ? `{${s.name}}` : (s as {type:"static";text:string}).text))
      .join("");
    onLabelChange(labelKey, newValue);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setEditing(false);
      }
    }, 0);
  };

  if (editing) {
    let firstStaticSeen = false;
    return (
      <span
        ref={containerRef}
        className={`inline-flex items-center gap-0.5 flex-wrap ${className}`}
      >
        {segments.map((seg, i) => {
          if (seg.type === "variable") {
            return (
              <span
                key={i}
                className="inline-flex items-center px-1.5 rounded bg-violet-600 text-white text-[0.7em] font-mono select-none cursor-not-allowed"
                title={`Runtime variable - replaced with actual ${seg.name} at presentation time`}
              >
                {`{${seg.name}}`}
              </span>
            );
          }
          const isFirst = !firstStaticSeen;
          if (isFirst) firstStaticSeen = true;
          return (
            <input
              key={i}
              ref={isFirst ? firstInputRef : undefined}
              type="text"
              value={seg.text}
              onChange={(e) => handleSegmentChange(i, e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className="bg-transparent border-b-2 border-amber-400 outline-none min-w-0"
              style={{ width: `${Math.max(seg.text.length, 3)}ch` }}
            />
          );
        })}
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  // Hover-to-edit trigger showing segments with variable chips
  return (
    <span
      className={`group cursor-pointer inline-flex items-center gap-1 flex-wrap hover:text-amber-500 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Click to edit static parts"
    >
      {segments.map((seg, i) =>
        seg.type === "variable" ? (
          <span
            key={i}
            className="inline-flex items-center px-1.5 rounded bg-violet-600 text-white text-[0.7em] font-mono"
          >
            {`{${seg.name}}`}
          </span>
        ) : (
          <span key={i}>{(seg as {type:"static";text:string}).text}</span>
        )
      )}
      {suffix && <span>{suffix}</span>}
      <Pencil className="size-4 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}

