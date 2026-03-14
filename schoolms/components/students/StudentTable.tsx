"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Role } from "@prisma/client";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import DeleteStudentDialog from "@/components/students/DeleteStudentDialog";

interface StudentData {
  id: string;
  name: string;
  indexNumber: string;
  classId: string;
  electives: {
    categoryI: string;
    categoryII: string;
    categoryIII: string;
  };
  isDeleted: boolean;
  createdAt: string;
  class: {
    id: string;
    grade: number;
    section: string;
  };
}

interface StudentTableProps {
  data: StudentData[];
  sort: string;
  order: string;
  role: Role;
  canAddEdit?: boolean;
  canDelete?: boolean;
}

export default function StudentTable({
  data,
  sort,
  order,
  role,
  canAddEdit,
  canDelete,
}: StudentTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isAdmin = role === Role.ADMIN || role === Role.SUPERADMIN;
  // Respect explicit canAddEdit/canDelete props if provided; fall back to role-based default
  const effectiveCanAddEdit = canAddEdit !== undefined ? canAddEdit : isAdmin;
  const effectiveCanDelete = canDelete !== undefined ? canDelete : isAdmin;
  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && selected.size < data.length;

  const toggleSort = useCallback(
    (column: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sort === column) {
        params.set("order", order === "asc" ? "desc" : "asc");
      } else {
        params.set("sort", column);
        params.set("order", "asc");
      }
      router.push(`/dashboard/students?${params.toString()}`);
    },
    [router, searchParams, sort, order]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((s) => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sort !== column)
      return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return order === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  };

  const exportCsv = () => {
    const rows = data.filter((s) => selected.has(s.id));
    const header =
      "Full Name,Index Number,Grade,Class Section,Elective I,Elective II,Elective III";
    const csvRows = rows.map(
      (s) =>
        `"${s.name}","${s.indexNumber}",${s.class.grade},"${s.class.section}","${s.electives.categoryI}","${s.electives.categoryII}","${s.electives.categoryIII}"`
    );
    const csvContent = [header, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSuccess = () => {
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2 mb-3">
          <span className="text-sm font-medium">
            {selected.size} student(s) selected
          </span>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5 mr-1" />
            CSV Export
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="size-4 rounded border-input"
              />
            </TableHead>
            <TableHead>
              <button
                onClick={() => toggleSort("indexNumber")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Index No. <SortIcon column="indexNumber" />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => toggleSort("name")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Full Name <SortIcon column="name" />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => toggleSort("grade")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Grade <SortIcon column="grade" />
              </button>
            </TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Electives</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No students found
              </TableCell>
            </TableRow>
          ) : (
            data.map((student) => (
              <TableRow
                key={student.id}
                data-state={selected.has(student.id) ? "selected" : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={() => toggleSelect(student.id)}
                    className="size-4 rounded border-input"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {student.indexNumber}
                </TableCell>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell>{student.class.grade}</TableCell>
                <TableCell>{student.class.section}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {student.electives.categoryI}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {student.electives.categoryII}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {student.electives.categoryIII}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link href={`/dashboard/students/${student.id}`}>
                        <Eye className="size-3.5" />
                      </Link>
                    </Button>
                    {effectiveCanAddEdit && (
                      <>
                        <Button variant="ghost" size="icon-xs" asChild>
                          <Link
                            href={`/dashboard/students/${student.id}/edit`}
                          >
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                      </>
                    )}
                    {effectiveCanDelete && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setDeleteTarget({
                            id: student.id,
                            name: student.name,
                          })
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <DeleteStudentDialog
        open={!!deleteTarget}
        studentId={deleteTarget?.id ?? ""}
        studentName={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
