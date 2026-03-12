"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, UserX, UserCheck, Plus } from "lucide-react";
import CreateUserModal from "./CreateUserModal";
import EditUserModal from "./EditUserModal";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  users: UserRow[];
  currentUserId: string;
  currentUserRole: string;
}

export default function UserTable({
  users,
  currentUserId,
  currentUserRole,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canActOn = (user: UserRow) => {
    if (currentUserRole === "SUPERADMIN") return user.role !== "SUPERADMIN";
    if (currentUserRole === "ADMIN")
      return user.role === "STAFF" || user.id === currentUserId;
    return false;
  };

  const canDeactivate = (user: UserRow) => {
    if (user.id === currentUserId) return false;
    if (user.role === "SUPERADMIN") return false;
    return canActOn(user);
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    setActionLoading(deactivateUser.id);
    try {
      const res = await fetch(`/api/users/${deactivateUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        toast.success(`${deactivateUser.name} has been deactivated.`);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to deactivate user.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setActionLoading(null);
      setDeactivateUser(null);
    }
  };

  const handleReactivate = async (user: UserRow) => {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        toast.success(`${user.name} has been reactivated.`);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reactivate user.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return (
          <Badge className="bg-purple-600 text-white hover:bg-purple-700">
            Super Admin
          </Badge>
        );
      case "ADMIN":
        return <Badge variant="secondary">Admin</Badge>;
      default:
        return <Badge variant="outline">Staff</Badge>;
    }
  };

  const statusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Active
      </Badge>
    ) : (
      <Badge variant="destructive">Deactivated</Badge>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>{statusBadge(user.isActive)}</TableCell>
                <TableCell className="text-right">
                  {canActOn(user) && (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditUser(user)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDeactivate(user) &&
                        (user.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeactivateUser(user)}
                            disabled={actionLoading === user.id}
                            title="Deactivate"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReactivate(user)}
                            disabled={actionLoading === user.id}
                            title="Reactivate"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!deactivateUser}
        onOpenChange={(open) => !open && setDeactivateUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivateUser?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent them from logging in. Their existing sessions
              will be terminated within the hour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Modal */}
      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentUserRole={currentUserRole}
      />

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          user={editUser}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  );
}
