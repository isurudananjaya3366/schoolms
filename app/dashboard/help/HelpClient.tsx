"use client";

import { useState } from "react";
import {
  LayoutDashboard, Users, ClipboardEdit,
  BarChart3, Presentation,
  HardDriveDownload, UserCog,
  BookOpen, GraduationCap, ChevronDown,
  ChevronRight, Info, Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ROLE_PRIORITY: Record<string, number> = {
  TEACHER: 1,
  STAFF: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

function hasRole(userRole: string, minRole: "ALL" | "STAFF" | "ADMIN" | "SUPERADMIN"): boolean {
  if (minRole === "ALL") return true;
  if (minRole === "STAFF") return ROLE_PRIORITY[userRole] >= 1;
  if (minRole === "ADMIN") return ROLE_PRIORITY[userRole] >= 2;
  if (minRole === "SUPERADMIN") return ROLE_PRIORITY[userRole] >= 3;
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface HelpSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  minRole: "ALL" | "STAFF" | "ADMIN" | "SUPERADMIN";
}

// ─── Screenshot helper component ─────────────────────────────────────────────
interface ScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
  /** Unused — kept for backward compat */
  annotatedSrc?: string;
}

function Screenshot({ src, alt, caption }: ScreenshotProps) {
  return (
    <div className="my-4 rounded-lg border border-border overflow-hidden shadow-sm">
      <div className="bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto block"
          style={{ maxHeight: "560px", objectFit: "contain", objectPosition: "top" }}
        />
      </div>
      {caption && (
        <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border">
          {caption}
        </p>
      )}
    </div>
  );
}

// ─── Tip / Info box ───────────────────────────────────────────────────────────
function Tip({ text, type = "tip" }: { text: string; type?: "tip" | "info" | "warning" }) {
  const styles = {
    tip: { icon: <Lightbulb className="h-4 w-4 shrink-0" />, bg: "bg-amber-50 border-amber-200 text-amber-900" },
    info: { icon: <Info className="h-4 w-4 shrink-0" />, bg: "bg-blue-50 border-blue-200 text-blue-900" },
    warning: { icon: <Info className="h-4 w-4 shrink-0" />, bg: "bg-red-50 border-red-200 text-red-900" },
  }[type];

  return (
    <div className={`flex gap-2 items-start rounded-md border px-3 py-2 text-sm my-3 ${styles.bg}`}>
      {styles.icon}
      <p>{text}</p>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg mb-3 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────
function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-none space-y-2 my-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 items-start text-sm">
          <span
            className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
            style={{ backgroundColor: "#2d9596" }}
          >
            {i + 1}
          </span>
          <span className="text-muted-foreground leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    SUPERADMIN: "bg-purple-100 text-purple-800 border-purple-300",
    ADMIN: "bg-blue-100 text-blue-800 border-blue-300",
    STAFF: "bg-green-100 text-green-800 border-green-300",
    TEACHER: "bg-orange-100 text-orange-800 border-orange-300",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors[role] ?? "bg-gray-100 text-gray-700"}`}>
      {role}
    </span>
  );
}

// ─── Nav Sections ─────────────────────────────────────────────────────────────
const SECTIONS: HelpSection[] = [
  { id: "getting-started", label: "Getting Started", icon: <BookOpen className="h-4 w-4" />, minRole: "ALL" },
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, minRole: "ALL" },
  { id: "students", label: "Students", icon: <Users className="h-4 w-4" />, minRole: "ALL" },
  { id: "marks", label: "Marks", icon: <ClipboardEdit className="h-4 w-4" />, minRole: "ALL" },
  { id: "reports", label: "Reports & Analytics", icon: <BarChart3 className="h-4 w-4" />, minRole: "ALL" },
  { id: "presentation", label: "Presentation & Calendar", icon: <Presentation className="h-4 w-4" />, minRole: "ADMIN" },
  { id: "administration", label: "Administration", icon: <UserCog className="h-4 w-4" />, minRole: "ADMIN" },
  { id: "system", label: "System Tools", icon: <HardDriveDownload className="h-4 w-4" />, minRole: "SUPERADMIN" },
  { id: "student-portal", label: "Student Portal", icon: <GraduationCap className="h-4 w-4" />, minRole: "ALL" },
];

// ─── Content sections ─────────────────────────────────────────────────────────
function GettingStartedSection({ userRole }: { userRole: string }) {
  const rolesTable = [
    { role: "SUPERADMIN", capabilities: "Full system access — all features including Backup, Audit Log, Config" },
    { role: "ADMIN", capabilities: "Manage users, students, marks, notices, settings, and reports" },
    { role: "STAFF", capabilities: "View & manage students, marks, reports, and analytics" },
    { role: "TEACHER", capabilities: "Enter marks for assigned class, view analytics and reports" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Welcome to SchoolMS</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          SchoolMS is a comprehensive school management system that helps you manage students, marks,
          reports, analytics, and more — all in one place. This guide will walk you through every feature
          so you can get up and running quickly.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Your Role</h3>
        <p className="text-sm text-muted-foreground mb-3">
          You are currently signed in as: <RoleBadge role={userRole} />
        </p>
        <p className="text-sm text-muted-foreground">
          SchoolMS uses a role-based permission system. Different roles see different pages and features.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {rolesTable.map((row) => (
                <tr key={row.role} className={`border-t ${row.role === userRole ? "bg-primary/5 font-medium" : ""}`}>
                  <td className="px-4 py-2"><RoleBadge role={row.role} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{row.capabilities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Signing In</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Staff and admins sign in at the <strong>/login</strong> page using their email and password.
        </p>
        <Screenshot
          src="/help/user-1773600485679.png"
          alt="Login page"
          caption="Login page — Enter your email address and password, then click Sign In. Use 'Forgot Password?' if you need to reset your credentials."
        />
        <Steps items={[
          "Open your browser and navigate to the SchoolMS URL",
          "Make sure the 'Staff / Admin' tab is selected",
          "Enter your email address in the Email field",
          "Enter your password in the Password field",
          "Click the 'Sign In' button",
          "You will be redirected to the Dashboard",
        ]} />
        <Tip text="If you forget your password, click 'Forgot Password?' on the login page to submit a reset request. Your administrator will review and approve it." />
      </div>

      <div>
        <h3 className="font-semibold mb-2">Navigation</h3>
        <p className="text-sm text-muted-foreground mb-2">
          The sidebar on the left contains all the main navigation links. Links are grouped into
          two sections: <strong>Main</strong> (daily tasks) and <strong>Administration</strong>
          (management tools). Only items your role has permission to access are shown.
        </p>
        <Screenshot
          src="/help/user-1773600597323.png"
          alt="Dashboard with sidebar navigation"
          caption="The sidebar shows all pages available to your role. The active page is highlighted in teal."
        />
        <Tip text="On mobile or small screens, use the hamburger menu icon at the top to open the navigation panel." type="info" />
      </div>
    </div>
  );
}

function DashboardSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">
          The Dashboard is your home screen — it gives you a quick snapshot of the school&apos;s current
          status and provides shortcuts to common tasks.
        </p>
      </div>

      <Screenshot
        src="/help/01-dashboard-overview.png"
        annotatedSrc="/help/01-dashboard-overview-annotated.png"
        alt="Dashboard overview page"
        caption="Dashboard overview showing KPI cards, recent activity, and quick actions."
      />

      <div>
        <h3 className="font-semibold mb-3">Page Sections</h3>

        <Accordion title="KPI Cards — Key Performance Indicators" defaultOpen>
          <p className="mb-2">The four cards at the top display real-time statistics:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Total Students</strong> — Number of active students enrolled in the system</li>
            <li><strong>Mark Records</strong> — Number of mark entries for the current term</li>
            <li><strong>Pending Entry</strong> — Students who don&apos;t have marks entered yet for the current term</li>
            <li><strong>W-Rate</strong> — Percentage of marks that fall below the passing threshold (W-Rule)</li>
          </ul>
          <Tip text="A high W-Rate indicates many students are struggling. Use the Analytics page to drill down." />
        </Accordion>

        <Accordion title="Recent Activity Feed">
          <p>
            The activity feed shows a live log of recent actions taken in the system — such as mark entries,
            student additions, and user changes. This helps you monitor what staff are doing.
          </p>
        </Accordion>

        <Accordion title="Quick Actions">
          <p className="mb-2">Quick Actions give you one-click access to the most common tasks:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Enter Marks</strong> — Jump directly to the Mark Entry page</li>
            <li><strong>Add Student</strong> — Open the Add Student form</li>
            <li><strong>Generate Report</strong> — Go to Student Reports</li>
            <li><strong>Student Portal</strong> — Open the public student lookup</li>
            <li><strong>Notice Board</strong> — View public notices</li>
            <li><strong>Presentation</strong> — Use Presentation Preview for parent meetings</li>
          </ul>
        </Accordion>
      </div>
    </div>
  );
}

function StudentsSection({ userRole }: { userRole: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Students</h2>
        <p className="text-sm text-muted-foreground">
          The Students section lets you manage all student records — view, search, add, edit, and delete students.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Student List</h3>
        <Screenshot
          src="/help/02-students-list.png"
          annotatedSrc="/help/02-students-list-annotated.png"
          alt="Students list page"
          caption="Students list — Use filters to narrow down the list, and the search box to find specific students."
        />

        <Accordion title="Searching & Filtering" defaultOpen>
          <p className="mb-2">You can narrow down the student list using:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Grade filter</strong> — Filter by grade (6 to 11)</li>
            <li><strong>Section filter</strong> — Filter by class section (A, B, C, etc.)</li>
            <li><strong>Search box</strong> — Search by student name or index number (e.g., STU0001)</li>
          </ul>
          <p className="mt-2">You can also click column headers (Index No, Full Name, Grade) to sort the table.</p>
        </Accordion>

        <Accordion title="Viewing a Student Profile">
          <p className="mb-2">
            Click the <strong>eye icon</strong> (👁) in the Actions column to view a student&apos;s full profile.
            The profile shows their class, electives, and all mark records.
          </p>
        </Accordion>

        {hasRole(userRole, "STAFF") && (
          <>
            <Accordion title="Editing a Student">
              <Steps items={[
                "Find the student in the list",
                "Click the pencil icon (✏) in the Actions column",
                "Update the student's Name, Index Number, Grade, Class Section, or Electives",
                "Click 'Save Changes' to apply",
              ]} />
            </Accordion>

            <Accordion title="Deleting a Student">
              <Steps items={[
                "Find the student in the list",
                "Click the trash icon (🗑) in the Actions column",
                "A confirmation dialog will appear — read it carefully",
                "Click 'Delete' to permanently remove the student record",
              ]} />
              <Tip text="Deletion is permanent and cannot be undone. Consider deactivating the student instead." type="warning" />
            </Accordion>
          </>
        )}
      </div>

      {hasRole(userRole, "STAFF") && (
        <div>
          <h3 className="font-semibold mb-3">Adding a New Student</h3>
          <Screenshot
            src="/help/03-add-student.png"
            annotatedSrc="/help/03-add-student-annotated.png"
            alt="Add student form"
            caption="Add Student form — Fill in all required fields and click 'Add Student' to create a new record."
          />
          <Steps items={[
            "Go to Students → click the '+ Add Student' button (top right)",
            "Enter the student's Full Name",
            "Enter a unique Index Number (e.g., STU0401)",
            "Enter Scholarship Exam Marks (0–200)",
            "Select the Grade (6–11)",
            "Select the Class Section (available sections appear after grade is chosen)",
            "Select up to 3 Elective subjects (one from each category)",
            "Click 'Add Student' to save",
          ]} />
          <Tip text="Index Numbers must be unique. Use a format like STU0001, STU0002, etc. for consistency." />
        </div>
      )}
    </div>
  );
}

function MarksSection({ userRole: _userRole }: { userRole: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Marks</h2>
        <p className="text-sm text-muted-foreground">
          The Marks section covers three related pages: Mark Entry (entering scores), Marks Management
          (publish/hold control), and View Marks (reading scores).
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Mark Entry</h3>
        <Screenshot
          src="/help/user-1773600739127.png"
          alt="Mark Entry page"
          caption="Mark Entry — Select Year, Grade, Class, and Term to load the student mark grid."
        />
        <p className="text-sm text-muted-foreground mb-3">
          Mark Entry is where teachers and staff input student scores for each subject and term.
        </p>

        <Accordion title="How to Enter Marks" defaultOpen>
          <Steps items={[
            "Select the Academic Year (e.g., 2026)",
            "Select the Grade (e.g., Grade 10)",
            "Select the Class Section (e.g., A)",
            "Select the Term (Term 1, Term 2, or Term 3)",
            "The student list will load automatically",
            "Type or update scores in the cells — each subject has its own column",
            "Use the Search box to quickly find a specific student",
            "Click 'Save' to save all changes for that class",
          ]} />
          <Tip text="Marks are auto-validated — values must be between 0 and 100. Cells with values below the W-Rule threshold will be highlighted in red." type="info" />
        </Accordion>

        <Accordion title="W-Rule (Warning Rule)">
          <p className="mb-2">
            The W-Rule is a configurable threshold (default 35). Any student scoring below this value
            in a subject is marked as &quot;W&quot; (warning). This is used in progress reports and analytics.
          </p>
          <p>
            On the mark entry grid, cells that would trigger a W-Rule flag appear highlighted.
            The dashboard KPI card shows the overall W-Rate for the school.
          </p>
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Marks Management</h3>
        <Screenshot
          src="/help/user-1773600812407.png"
          alt="Marks Management page"
          caption="Marks Management — Use filters to select a class and control whether marks are published or on hold."
        />
        <Accordion title="Publishing and Holding Marks" defaultOpen>
          <p className="mb-2">
            This page lets you control whether entered marks are visible to students on the Student Portal.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Published</strong> marks are visible to students on the portal</li>
            <li><strong>On Hold</strong> marks are only visible to staff in the dashboard</li>
          </ul>
          <Steps items={[
            "Select the Academic Year, Grade, and Class using the dropdowns",
            "The current release status for each term will be displayed",
            "Toggle the status to 'Published' or 'On Hold' as needed",
          ]} />
          <Tip text="Always verify marks are correct before publishing. Once published, students can view their scores." type="warning" />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">View Marks</h3>
        <Screenshot
          src="/help/user-1773600873393.png"
          alt="View Marks page"
          caption="View Marks — Select Grade, Class, and Term to view a read-only table of student scores."
        />
        <Accordion title="Using View Marks" defaultOpen>
          <p className="mb-2">
            View Marks provides a read-only overview of entered marks. Use it to review scores before publishing.
          </p>
          <Steps items={[
            "Select the Year, Grade, Class, and Term",
            "The mark table will load showing all students and their scores",
            "Use the Student Search box to find a specific student quickly",
            "Scores shown here are the current saved values (both published and unpublished)",
          ]} />
        </Accordion>
      </div>
    </div>
  );
}

function ReportsSection({ userRole }: { userRole: string }) {
  void userRole;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Reports & Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Generate individual student reports, visualize class-wide performance, and see top performers
          on the Leaderboard.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Student Reports (Progress Reports)</h3>
        <Screenshot
          src="/help/user-1773600953776.png"
          alt="Student Reports page"
          caption="Student Reports — Search for a student, preview their report, then download or print the PDF."
        />
        <Screenshot
          src="/help/user-1773601031923.png"
          alt="Student Reports page (continued)"
        />
        <Accordion title="Generating a Progress Report" defaultOpen>
          <Steps items={[
            "Go to 'Student Reports' in the sidebar",
            "In the 'Search Student' box, type a student name or index number",
            "Select the student from the results",
            "Choose the Academic Year",
            "Click 'Preview Report' to view the PDF in the browser",
            "Click 'Download' to save the PDF file to your computer",
            "Click 'Print' to open the browser print dialog",
          ]} />
          <Tip text="Progress reports include all subjects, term-by-term scores, W-Rule flags, and a performance bar chart." type="info" />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Analytics Dashboard</h3>
        <Screenshot
          src="/help/user-1773601125864.png"
          alt="Analytics Dashboard"
          caption="Analytics Dashboard — Heatmap showing mark distribution across subjects and performance bands."
        />
        <p className="text-sm text-muted-foreground mb-3">
          The Analytics Dashboard shows cohort-level performance data across grades, terms, and subjects.
        </p>
        <Accordion title="Using the Analytics Filters" defaultOpen>
          <p className="mb-2">
            You can filter the analytics view by:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Grade</strong> — Focus on a specific grade or view all</li>
            <li><strong>Class</strong> — Drill into a specific class section</li>
            <li><strong>Term</strong> — View data for a specific term or all terms</li>
            <li><strong>Year</strong> — Select the academic year</li>
          </ul>
        </Accordion>
        <Accordion title="Reading the Grade Distribution Heatmap">
          <p className="mb-2">
            The heatmap displays the percentage of students in each performance band (0–34, 35–49, 50–64, 65–79, 80–100)
            for each subject. Darker blue = more students in that band.
          </p>
          <p>
            Hover over any cell to see the exact count and percentage. This helps quickly identify
            which subjects have the most struggling students.
          </p>
        </Accordion>
        <Accordion title="Downloading Analytics Reports">
          <p className="mb-2">Two download options are available (top right):</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Download Full Analytics Report</strong> — Downloads a PDF with all charts and data</li>
            <li><strong>Download Student Reports</strong> — Downloads a bulk PDF of individual progress reports for the selected filter</li>
          </ul>
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Leaderboard</h3>
        <Screenshot
          src="/help/user-1773601174713.png"
          alt="Leaderboard page"
          caption="Leaderboard — Shows top-performing students across grades and classes."
        />
        <Accordion title="Using the Leaderboard" defaultOpen>
          <Steps items={[
            "Select the Year and Term",
            "Select the Grade you want to see rankings for",
            "Optionally select a specific Class for class-level rankings",
            "The ranked list of top students will appear",
          ]} />
          <Tip text="The leaderboard shows rankings based on total marks across all subjects for the selected term. Used during parent meetings and award ceremonies." type="info" />
        </Accordion>
      </div>
    </div>
  );
}

function PresentationSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Presentation & Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Tools for parent-teacher meetings — the Presentation Preview creates a full-screen slide show
          of student results, and the Meeting Calendar helps schedule events.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Presentation Preview</h3>
        <Screenshot
          src="/help/10-presentation-preview.png"
          alt="Presentation Preview page"
          caption="Presentation Preview — Configure the class and academic year, then launch the full-screen presenter."
        />
        <Screenshot
          src="/help/user-1773601267601.png"
          alt="Presentation Preview (continued)"
        />
        <Screenshot
          src="/help/user-1773601283629.png"
          alt="Presentation Preview (continued)"
        />
        <Accordion title="Launching a Class Presentation" defaultOpen>
          <Steps items={[
            "Go to 'Presentation Preview' in the sidebar",
            "Select the Grade and Class Section from the Configure Presenter panel",
            "Select the Academic Year and Focus Term",
            "Choose the display language (English or Sinhala)",
            "The class summary will appear (e.g., 'Grade 11A - 2026, 30 students in queue')",
            "Click 'Launch Presenter' to open the full-screen presentation",
            "Use the toolbar controls to navigate between student slides",
          ]} />
          <Tip text="The presenter is designed for use on a projector during parent meetings. Each slide shows one student's results and performance chart." type="info" />
        </Accordion>

        <Accordion title="Exporting the Presentation as PDF">
          <p>
            In the full-screen presenter view, use the PDF export button in the toolbar
            to generate a printable version of all slides for the selected class.
          </p>
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Meeting Calendar</h3>
        <Screenshot
          src="/help/11-meeting-calendar.png"
          annotatedSrc="/help/11-meeting-calendar-annotated.png"
          alt="Meeting Calendar page"
          caption="Meeting Calendar — View and schedule meetings using the monthly calendar view."
        />
        <Accordion title="Scheduling a Meeting" defaultOpen>
          <Steps items={[
            "Go to 'Meeting Calendar' in the sidebar",
            "Click '+ New Meeting' in the top right corner",
            "Enter the meeting title, date, time, and description",
            "Click 'Save' to add the event to the calendar",
          ]} />
        </Accordion>
        <Accordion title="Navigating the Calendar">
          <p className="mb-2">
            Use the left ( &lt; ) and right ( &gt; ) arrows next to the month name to move between months.
            Today&apos;s date is highlighted with a teal circle.
          </p>
          <p>
            Click on any event in the calendar to view its details, edit, or delete it.
          </p>
        </Accordion>
      </div>
    </div>
  );
}

function AdministrationSection({ userRole }: { userRole: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Administration</h2>
        <p className="text-sm text-muted-foreground">
          Administrative tools for managing users, notices, password requests, system settings,
          and teacher assignments.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">User Management</h3>
        <Screenshot
          src="/help/16-users.png"
          annotatedSrc="/help/16-users-annotated.png"
          alt="User Management page"
          caption="User Management — View all users, their roles and status. Create new users or edit existing ones."
        />
        <Accordion title="Creating a New User" defaultOpen>
          <Steps items={[
            "Go to 'Users' in the sidebar",
            "Click '+ Create User' in the top right",
            "Enter the user's Full Name and Email address",
            "Select their Role (TEACHER, STAFF, or ADMIN)",
            "Enter an initial password for the account",
            "Click 'Create' to save the new user",
          ]} />
          <Tip text={`As ${userRole}, you can create users with roles: ${userRole === "SUPERADMIN" ? "ADMIN, STAFF, TEACHER" : "STAFF, TEACHER"}.`} type="info" />
        </Accordion>

        <Accordion title="Editing or Deactivating a User">
          <Steps items={[
            "Find the user in the table",
            "Click the pencil icon (✏) to edit their details",
            "Or click the person-with-X icon to deactivate/reactivate their account",
          ]} />
          <Tip text="Deactivated users cannot log in but their data is preserved." type="warning" />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Assign Teachers</h3>
        <Screenshot
          src="/help/user-1773601341829.png"
          alt="Assign Teachers page"
          caption="Assign Teachers — Map teacher accounts to specific classes so they can only enter marks for their class."
        />
        <Accordion title="Assigning a Teacher to a Class" defaultOpen>
          <Steps items={[
            "Go to 'Assign Teachers' in the sidebar",
            "Select the Class from the dropdown (e.g., Grade 10A)",
            "The current teacher assignments for that class will load",
            "Assign teachers to specific subjects by selecting from the dropdown",
            "Click 'Save Assignments' to confirm",
          ]} />
          <Tip text="Teachers can only enter marks for classes they are assigned to. This prevents accidental cross-class data entry." type="info" />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Manage Notices</h3>
        <Screenshot
          src="/help/13-manage-notices.png"
          annotatedSrc="/help/13-manage-notices-annotated.png"
          alt="Manage Notices page"
          caption="Manage Notices — Create, publish, archive, and delete school notices for the public notice board."
        />
        <Accordion title="Creating a Notice" defaultOpen>
          <Steps items={[
            "Go to 'Manage Notices' in the sidebar",
            "Click '+ New Notice' to open the notice editor",
            "Enter a Title and the notice Content",
            "Select the Audience (Everyone, Staff, or Teachers)",
            "Choose status: 'Published' (visible immediately) or 'Draft' (hidden)",
            "Click 'Save' to publish the notice",
          ]} />
        </Accordion>
        <Accordion title="Notice Statuses">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Published</strong> — Visible on the public Notice Board</li>
            <li><strong>Draft</strong> — Saved but not yet visible to public</li>
            <li><strong>Archived</strong> — Hidden from view but kept on record</li>
          </ul>
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Password Reset Requests</h3>
        <Screenshot
          src="/help/14-password-requests.png"
          annotatedSrc="/help/14-password-requests-annotated.png"
          alt="Password Reset Requests page"
          caption="Password Requests — Review and approve password reset requests from staff members."
        />
        <Accordion title="Handling Password Reset Requests" defaultOpen>
          <p className="mb-2">
            When a staff member uses &quot;Forgot Password?&quot; on the login page, their request appears here.
          </p>
          <Steps items={[
            "Go to 'Password Requests' in the sidebar",
            "Review pending requests in the list",
            "Click 'Approve' to grant the reset and send a temporary password",
            "Click 'Deny' to reject the request",
            "Click 'Refresh' to check for new requests",
          ]} />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Settings</h3>
        <Screenshot
          src="/help/15-settings.png"
          annotatedSrc="/help/15-settings-annotated.png"
          alt="Settings page"
          caption="Settings — Configure school branding, academic year, subjects, and role permissions."
        />
        <Accordion title="School Name & Logo" defaultOpen>
          <p className="mb-2">
            Set the school&apos;s display name and logo. The name appears on the login page and in PDF reports.
            Upload a logo using the Upload button or paste a direct image URL.
          </p>
          <Steps items={[
            "Go to 'Settings' in the sidebar",
            "Update the 'Name' field with your school's official name",
            "Click 'Upload' to upload a logo file, or paste a URL",
            "Click 'Save' to apply changes",
          ]} />
        </Accordion>
        <Accordion title="Academic Year">
          <p>
            The current academic year affects the default year shown on mark entry and analytics pages.
            Changing it does not alter any existing records.
          </p>
        </Accordion>
        <Accordion title="Subject Configuration">
          <p>
            Configure display names for core subjects and set up elective categories.
            Core subjects are: Sinhala, Buddhism, Maths, Science, English, History.
            Elective categories I, II, and III each have a configurable list of subjects students can choose from.
          </p>
        </Accordion>
        {hasRole(userRole, "SUPERADMIN") && (
          <Accordion title="Role Permissions (SUPERADMIN only)">
            <p>
              The permissions panel lets you toggle specific features on/off for each role.
              For example, you can prevent TEACHER from viewing the Leaderboard, or allow STAFF to manage notices.
            </p>
          </Accordion>
        )}
      </div>
    </div>
  );
}

function SystemSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">System Tools</h2>
        <p className="text-sm text-muted-foreground">
          Critical system-level tools available only to SUPERADMIN — including database backups and audit logging.
        </p>
        <Tip text="These tools have significant effects on the system. Only SUPERADMIN users can access them." type="warning" />
      </div>

      <div>
        <h3 className="font-semibold mb-3">Backup Management</h3>
        <Screenshot
          src="/help/12-backup.png"
          annotatedSrc="/help/12-backup-annotated.png"
          alt="Backup Management page"
          caption="Backup Management — Create on-demand backups and restore from previous backup files."
        />
        <Accordion title="Creating a Backup" defaultOpen>
          <Steps items={[
            "Go to 'Backup' in the sidebar",
            "Click 'Back Up Now' to create an immediate database backup",
            "The backup will appear in the list with date, time, file size, and status",
            "Backups are stored locally by default; configure cloud storage in settings for automatic offsite copies",
          ]} />
          <Tip text="Run backups regularly — especially before making major changes like bulk student imports or mark updates." type="warning" />
        </Accordion>
        <Accordion title="Restoring from a Backup">
          <Steps items={[
            "Click 'Restore from File' to upload a previously downloaded backup file",
            "Or click the restore icon (↺) next to a listed backup to restore from it directly",
            "Read the confirmation dialog carefully — restoration overwrites current data",
            "Confirm to proceed with the restore",
          ]} />
          <Tip text="Restoring will overwrite ALL current data. Only do this when you are certain — consider making a fresh backup first." type="warning" />
        </Accordion>
        <Accordion title="Deleting Old Backups">
          <p>
            Click the trash icon next to a backup entry to delete it from the list.
            Old backups take up storage space, so clean them up periodically.
          </p>
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Audit Log</h3>
        <Screenshot
          src="/help/18-audit-log.png"
          annotatedSrc="/help/18-audit-log-annotated.png"
          alt="Audit Log page"
          caption="Audit Log — Complete history of all system actions with user, timestamp, and IP address."
        />
        <Accordion title="Reviewing the Audit Log" defaultOpen>
          <p className="mb-2">
            The Audit Log records every significant action in the system — mark entries, user changes,
            student modifications, and more. Use it to investigate issues or monitor activity.
          </p>
          <Steps items={[
            "Go to 'Audit Log' in the sidebar",
            "Use the 'From' and 'To' date pickers to filter by date range",
            "Use the 'User' dropdown to filter by a specific user",
            "Use the 'Actions' dropdown to filter by action type",
            "Use the Search box to find specific records",
            "Click any row to expand and see full details",
          ]} />
        </Accordion>
        <Accordion title="Exporting the Audit Log">
          <p>
            Click <strong>Export CSV</strong> to download the current filtered view as a CSV file.
            This is useful for compliance reporting or offline analysis.
          </p>
        </Accordion>
        <Accordion title="Clearing the Log">
          <p>
            The <strong>Clear Log</strong> button removes all audit entries. This action is irreversible.
            Export the log first if you need to keep a record.
          </p>
          <Tip text="Clearing the audit log permanently deletes all records. Always export first." type="warning" />
        </Accordion>
      </div>
    </div>
  );
}

function StudentPortalSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Student Portal</h2>
        <p className="text-sm text-muted-foreground">
          The Student Portal is a public-facing page where students can look up their own marks and
          profile — no login required.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">How Students Access Their Marks</h3>
        <Screenshot
          src="/help/19-student-portal.png"
          alt="Student Portal search page"
          caption="Student Portal (/student) — Students enter their name or index number to find their profile."
        />
        <Screenshot
          src="/help/user-1773601422965.png"
          alt="Student Portal search page (continued)"
        />
        <Accordion title="Searching for a Student Profile" defaultOpen>
          <Steps items={[
            "Students open a browser and go to /student (no login required)",
            "They type their full name (e.g., 'Sahan Silva') or index number (e.g., 'STU0001') in the search box",
            "A fuzzy match will find their record even with slight spelling variations",
            "They click their name in the results to open their profile",
          ]} />
          <Tip text="Only marks that have been Published by an admin will be visible on the Student Portal." type="info" />
        </Accordion>

        <h3 className="font-semibold mb-3 mt-4">Student Profile View</h3>
        <Screenshot
          src="/help/20-student-profile.png"
          annotatedSrc="/help/20-student-profile-annotated.png"
          alt="Student profile view with marks and chart"
          caption="Student profile — Shows academic records by term and a visual performance chart."
        />
        <Accordion title="What Students See on Their Profile" defaultOpen>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Name, Index Number, Grade, Section</strong> — Basic info</li>
            <li><strong>Elective subjects</strong> — Their enrolled electives</li>
            <li><strong>Academic Records table</strong> — Published marks for each subject, grouped by term</li>
            <li><strong>W marks</strong> — Subjects where they scored below the threshold are shown</li>
            <li><strong>Performance Chart</strong> — Bar chart showing marks across terms and subjects</li>
          </ul>
          <Tip text="Students can toggle 'Full Academic Records' to see all years, not just the current one." type="info" />
        </Accordion>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Notice Board (Public)</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Students and parents can also view published school notices at <strong>/notices</strong>.
          This page shows all notices published for &quot;Everyone&quot; visibility.
        </p>
        <Tip text="To publish a notice that appears here, go to 'Manage Notices' in the dashboard and set visibility to 'Everyone' and status to 'Published'." type="info" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface HelpClientProps {
  role: string;
  displayName: string;
}

export default function HelpClient({ role, displayName }: HelpClientProps) {
  const [activeSection, setActiveSection] = useState("getting-started");

  const visibleSections = SECTIONS.filter((s) => hasRole(role, s.minRole));

  const renderContent = () => {
    switch (activeSection) {
      case "getting-started": return <GettingStartedSection userRole={role} />;
      case "dashboard": return <DashboardSection />;
      case "students": return <StudentsSection userRole={role} />;
      case "marks": return <MarksSection userRole={role} />;
      case "reports": return <ReportsSection userRole={role} />;
      case "presentation": return <PresentationSection />;
      case "administration": return <AdministrationSection userRole={role} />;
      case "system": return <SystemSection />;
      case "student-portal": return <StudentPortalSection />;
      default: return <GettingStartedSection userRole={role} />;
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar nav */}
      <div className="w-56 shrink-0">
        <div className="sticky top-0">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">Contents</p>
          </div>
          <nav className="space-y-1">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  activeSection === section.id
                    ? "text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                style={activeSection === section.id ? { backgroundColor: "#2d9596", color: "white" } : {}}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          <Separator className="my-4" />

          <div className="px-2">
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium">{displayName}</span>
            </p>
            <RoleBadge role={role} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" style={{ color: "#2d9596" }} />
              Help &amp; User Guide
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                SchoolMS Documentation
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
