"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  FileText,
  Printer,
  Download,
  Maximize,
  Minimize,
  X,
  Loader2,
} from "lucide-react";
import SlideThumbnailStrip from "./SlideThumbnailStrip";

interface PresenterToolbarProps {
  slideIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onSetSlide: (index: number) => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  aspectRatio: "16:9" | "A4";
  onAspectRatioToggle: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onPrint: () => void;
  onDownloadPDF: () => void;
  isPDFExporting: boolean;
  /** When true the Prev button stays enabled even at slide 0 (jumps to prev student) */
  hasPrevStudent?: boolean;
  /** When true the Next button stays enabled even at last slide (jumps to next student) */
  hasNextStudent?: boolean;
}

export default function PresenterToolbar({
  slideIndex,
  totalSlides,
  onPrev,
  onNext,
  onSetSlide,
  theme,
  onThemeToggle,
  aspectRatio,
  onAspectRatioToggle,
  fontSize,
  onFontSizeChange,
  onPrint,
  onDownloadPDF,
  isPDFExporting,
  hasPrevStudent,
  hasNextStudent,
}: PresenterToolbarProps) {
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Fullscreen listeners
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide in fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setIsVisible(true);
      return;
    }
    const handleMouseMove = (e: MouseEvent) => {
      setIsVisible(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // If near bottom edge (within 100px), keep visible
      if (e.clientY > window.innerHeight - 100) return;
      idleTimerRef.current = setTimeout(() => setIsVisible(false), 2000);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    window.close();
    // If window.close() is blocked (tab not opened via window.open)
    setTimeout(() => {
      if (!window.closed) {
        alert("Please close this tab manually using your browser controls.");
      }
    }, 100);
  };

  return (
    <>
      {/* Thumbnail strip */}
      <SlideThumbnailStrip
        isOpen={isThumbnailOpen}
        currentSlide={slideIndex}
        totalSlides={totalSlides}
        onSelect={(i) => {
          onSetSlide(i);
          setIsThumbnailOpen(false);
        }}
        onClose={() => setIsThumbnailOpen(false)}
      />

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className={`fixed bottom-0 inset-x-0 z-50 flex items-center justify-between px-4 py-2.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-t border-border transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Left section */}
        <div className="flex items-center gap-2">
          {/* Slide counter (clickable) */}
          <button
            className="text-sm font-mono text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline min-w-12.5"
            onClick={() => setIsThumbnailOpen(!isThumbnailOpen)}
          >
            {slideIndex + 1} / {totalSlides}
          </button>
        </div>

        {/* Center section: Navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onPrev}
            disabled={slideIndex === 0 && !hasPrevStudent}
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            disabled={slideIndex === totalSlides - 1 && !hasNextStudent}
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Font size */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-xs font-bold"
            onClick={() => onFontSizeChange(Math.max(0.7, fontSize - 0.1))}
            disabled={fontSize <= 0.7}
            aria-label="Decrease font size"
          >
            A↓
          </Button>
          <span className="text-xs text-muted-foreground w-8 text-center">
            {fontSize.toFixed(1)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-xs font-bold"
            onClick={() => onFontSizeChange(Math.min(1.5, fontSize + 0.1))}
            disabled={fontSize >= 1.5}
            aria-label="Increase font size"
          >
            A↑
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Theme */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onThemeToggle}
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
          </Button>

          {/* Aspect ratio */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAspectRatioToggle}
            title={aspectRatio}
            aria-label="Toggle aspect ratio"
          >
            {aspectRatio === "16:9" ? (
              <Monitor className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </Button>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5">
          {/* Print */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrint}
            title="Print"
            aria-label="Print"
          >
            <Printer className="size-4" />
          </Button>

          {/* PDF Download */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDownloadPDF}
            disabled={isPDFExporting}
            title="Download PDF"
            aria-label="Download PDF"
          >
            {isPDFExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
