"use client";

import { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  User,
  Table2,
  Star,
  AlertTriangle,
  Award,
} from "lucide-react";

interface SlideThumbnailStripProps {
  isOpen: boolean;
  currentSlide: number;
  totalSlides: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

const SLIDE_META = [
  { title: "Overview", icon: User },
  { title: "Term 1 Marks", icon: Table2 },
  { title: "Term 2 Marks", icon: Table2 },
  { title: "Term 3 Marks", icon: Table2 },
  { title: "Performance Chart", icon: BarChart3 },
  { title: "Subject Highlights", icon: Star },
  { title: "W Summary", icon: AlertTriangle },
  { title: "Overall Summary", icon: Award },
];

export default function SlideThumbnailStrip({
  isOpen,
  currentSlide,
  totalSlides,
  onSelect,
  onClose: _onClose,
}: SlideThumbnailStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active into view
  useEffect(() => {
    if (isOpen && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [isOpen, currentSlide]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-14 inset-x-0 z-40 px-4"
        >
          <div
            ref={stripRef}
            className="mx-auto max-w-4xl flex gap-2 overflow-x-auto rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur p-2 shadow-lg border border-border"
          >
            {SLIDE_META.slice(0, totalSlides).map((meta, i) => {
              const Icon = meta.icon;
              const isActive = i === currentSlide;
              return (
                <button
                  key={i}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onSelect(i)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700 text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="whitespace-nowrap">
                    {i + 1}. {meta.title}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
