import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Clock, ChevronLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Notice Board - SchoolMS",
  description: "Latest notices and announcements from our school.",
};

// Revalidate every 5 minutes so published notices appear quickly
export const revalidate = 300;

async function getPublishedNotices() {
  const now = new Date();
  try {
    return await prisma.notice.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { publishedAt: "desc" },
    });
  } catch {
    return [];
  }
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return formatDate(date);
}

function getTargetLabel(roles: string[]): string {
  if (roles.includes("ALL") || roles.length === 0) return "Everyone";
  return roles
    .map((r) => r.charAt(0) + r.slice(1).toLowerCase())
    .join(", ");
}

export default async function NoticeBoardPage() {
  const notices = await getPublishedNotices();

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Notice Board</h1>
              <p className="text-xs text-muted-foreground">SchoolMS</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Sign In
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {notices.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No notices yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later for school announcements.
            </p>
          </div>
        ) : (
          /* Timeline */
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border" aria-hidden="true" />

            <div className="space-y-8">
              {notices.map((notice, index) => (
                <div key={notice.id} className="relative flex gap-6">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
                    <div
                      className={`h-4 w-4 rounded-full border-2 border-background shadow-md ${
                        index === 0
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>

                  {/* Notice card */}
                  <div
                    className={`flex-1 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${
                      index === 0 ? "border-primary/30 ring-1 ring-primary/10" : ""
                    }`}
                  >
                    {/* Top meta */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {index === 0 && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                          Latest
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                        {getTargetLabel(notice.targetRoles)}
                      </Badge>
                      {notice.expiresAt && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600">
                          <Clock className="h-3 w-3" />
                          Expires {formatDate(notice.expiresAt)}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-base font-semibold leading-snug mb-2">
                      {notice.title}
                    </h2>

                    {/* Content */}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {notice.content}
                    </p>

                    {/* Footer */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(notice.publishedAt ?? notice.createdAt)}
                      </span>
                      <span className="text-muted-foreground/60">
                        {timeAgo(notice.publishedAt ?? notice.createdAt)}
                      </span>
                      <span className="ml-auto">
                        By <strong className="font-medium">{notice.createdBy}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
