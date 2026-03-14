"use client";

import { useState } from "react";
import StudentForm from "@/components/students/StudentForm";
import RecentStudentsDrawer from "@/components/students/RecentStudentsDrawer";

interface ElectiveCategory {
  label: string;
  subjects: string[];
}

interface AddStudentViewProps {
  availableClasses: { id: string; grade: number; section: string }[];
  electiveOptions: {
    categoryI: ElectiveCategory;
    categoryII: ElectiveCategory;
    categoryIII: ElectiveCategory;
  };
}

export default function AddStudentView({
  availableClasses,
  electiveOptions,
}: AddStudentViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Add Student</h1>
        <RecentStudentsDrawer refreshKey={refreshKey} />
      </div>
      <StudentForm
        mode="create"
        availableClasses={availableClasses}
        electiveOptions={electiveOptions}
        onStudentAdded={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
