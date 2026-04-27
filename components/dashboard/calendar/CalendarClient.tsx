"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import MeetingFormModal from "./MeetingFormModal";

interface Meeting {
  id: string;
  title: string;
  classGroup: string;
  date: string;
  startTime: string;
  endTime: string | null;
  description: string | null;
  createdBy: string;
}

interface ClassGroup {
  id: string;
  grade: number;
  section: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CLASS_COLORS: Record<string, string> = {};
const PALETTE = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-orange-500",
  "bg-teal-500",
];
let colorIdx = 0;
function getClassColor(classGroup: string): string {
  if (!CLASS_COLORS[classGroup]) {
    CLASS_COLORS[classGroup] = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;
  }
  return CLASS_COLORS[classGroup];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatMonth(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

interface CalendarClientProps {
  role: string;
}

export default function CalendarClient({ role }: CalendarClientProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string>("");

  const canEdit = role === "ADMIN" || role === "SUPERADMIN";

  // Fetch meetings for the current month
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings?month=${formatMonth(viewYear, viewMonth)}`);
      if (res.ok) {
        const data: Meeting[] = await res.json();
        setMeetings(data);
      }
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  // Fetch class groups once
  useEffect(() => {
    fetch("/api/class-groups")
      .then((r) => r.json())
      .then((data: ClassGroup[]) => setClassGroups(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Calendar grid
  const numDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);
  const totalCells = Math.ceil((startDay + numDays) / 7) * 7;

  // Group meetings by date
  const meetingsByDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const openCreate = (dateStr: string) => {
    if (!canEdit) return;
    setEditMeeting(null);
    setPrefilledDate(dateStr);
    setModalOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    if (!canEdit) return;
    setEditMeeting(meeting);
    setPrefilledDate(meeting.date);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    fetchMeetings();
  };

  const handleDeleted = () => {
    setModalOpen(false);
    fetchMeetings();
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-6 text-primary" />
          <h1 className="text-xl font-bold">Meeting Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-40 text-center text-base font-semibold">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>

          {canEdit && (
            <Button
              size="sm"
              className="ml-2 gap-1.5"
              onClick={() => openCreate(todayStr)}
            >
              <Plus className="size-4" />
              New Meeting
            </Button>
          )}
        </div>
      </div>

      {/* ── Day headers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase text-muted-foreground tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-7 border-l border-t">
        {Array.from({ length: totalCells }, (_, idx) => {
          const dayNum = idx - startDay + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= numDays;
          const dateStr = isCurrentMonth
            ? toDateStr(viewYear, viewMonth, dayNum)
            : "";
          const isToday = dateStr === todayStr;
          const dayMeetings = dateStr ? (meetingsByDate[dateStr] ?? []) : [];

          return (
            <div
              key={idx}
              onClick={() => isCurrentMonth && canEdit && openCreate(dateStr)}
              className={`border-b border-r min-h-28 p-1 flex flex-col gap-0.5 transition-colors ${
                isCurrentMonth
                  ? canEdit
                    ? "cursor-pointer hover:bg-accent/30"
                    : ""
                  : "bg-muted/20"
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between px-0.5 mb-0.5">
                {isCurrentMonth ? (
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {dayNum}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">
                    {dayNum > 0 && dayNum <= daysInMonth(
                      viewMonth === 11 ? viewYear + 1 : viewYear,
                      viewMonth === 11 ? 0 : viewMonth + 1
                    )
                      ? dayNum
                      : ""}
                  </span>
                )}
              </div>

              {/* Meeting chips */}
              {dayMeetings.slice(0, 3).map((m) => (
                <button
                  key={m.id}
                  onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                  className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] leading-tight font-medium text-white truncate ${getClassColor(m.classGroup)}`}
                  title={`${m.title} - ${m.classGroup} @ ${m.startTime}`}
                >
                  <span className="opacity-80 mr-1">{m.startTime}</span>
                  {m.title}
                </button>
              ))}
              {dayMeetings.length > 3 && (
                <span className="text-[10px] text-muted-foreground px-1">
                  +{dayMeetings.length - 3} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center pointer-events-none">
          <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
        </div>
      )}

      {/* Meeting form modal */}
      {modalOpen && (
        <MeetingFormModal
          classGroups={classGroups}
          initialDate={prefilledDate}
          meeting={editMeeting}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
