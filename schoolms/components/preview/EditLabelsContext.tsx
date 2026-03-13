"use client";

import { createContext, useContext } from "react";
import type { SlideLabels, SlideLabelKey } from "@/types/preview";

interface EditLabelsContextValue {
  /** Whether slides are rendering in editable (configure) mode */
  isEditable: boolean;
  /** Current label overrides */
  labels: SlideLabels;
  /** Callback to update a label by key */
  onLabelChange: (key: SlideLabelKey, value: string) => void;
}

export const EditLabelsContext = createContext<EditLabelsContextValue>({
  isEditable: false,
  labels: {},
  onLabelChange: () => {},
});

export function useEditLabels() {
  return useContext(EditLabelsContext);
}
