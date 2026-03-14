"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import EditableField from "@/components/preview/EditableField";

interface SlideOverviewProps {
  student: {
    name: string;
    indexNumber: string | null;
    className: string;
    grade: number;
  };
  schoolName: string;
  academicYear: string;
}

export default function SlideOverview({
  student,
  schoolName,
  academicYear,
}: SlideOverviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
      <motion.h2
        className="text-lg font-medium tracking-widest uppercase text-muted-foreground"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {schoolName}
      </motion.h2>

      <motion.p
        className="text-sm font-semibold uppercase tracking-widest text-amber-600"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <EditableField labelKey="overview" />
      </motion.p>

      <motion.h1
        className="text-5xl font-bold tracking-tight"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
      >
        {student.name}
      </motion.h1>

      <motion.p
        className="text-xl text-muted-foreground font-mono"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        {student.indexNumber ?? "N/A"}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Badge variant="secondary" className="text-base px-4 py-1.5">
          Grade {student.grade} - {student.className}
        </Badge>
      </motion.div>

      <motion.p
        className="text-sm text-muted-foreground mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        Academic Year {academicYear}
      </motion.p>
    </div>
  );
}
