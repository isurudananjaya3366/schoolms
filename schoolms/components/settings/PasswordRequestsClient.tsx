"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, RefreshCw, ShieldCheck, ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface PasswordRequest {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  requestedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  STAFF: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  TEACHER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  STUDENT: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PasswordRequestsClient() {
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    request: PasswordRequest | null;
  }>({ open: false, action: null, request: null });

  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/password-reset-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function openConfirm(action: "approve" | "reject", request: PasswordRequest) {
    setConfirmDialog({ open: true, action, request });
  }

  async function handleConfirm() {
    const { action, request } = confirmDialog;
    if (!action || !request) return;

    setConfirmDialog({ open: false, action: null, request: null });
    setProcessing(request.id);

    try {
      const res = await fetch(`/api/password-reset-requests/${request.id}/${action}`, {
        method: "POST",
      });
      if (res.ok) {
        // Remove processed request from list
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      }
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Loading requests…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Password Reset Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve password reset requests from users.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRequests(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-semibold text-lg">No Pending Requests</h3>
            <p className="text-muted-foreground text-sm mt-1">
              All password reset requests have been reviewed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card key={req.id} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      {req.userName}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {req.userEmail}
                    </CardDescription>
                  </div>
                  <Badge
                    className={`shrink-0 text-xs font-medium ${
                      ROLE_COLORS[req.userRole] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {req.userRole}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClockIcon className="h-4 w-4 shrink-0" />
                  <span>Requested {formatDate(req.requestedAt)}</span>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => openConfirm("approve", req)}
                    disabled={processing === req.id}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => openConfirm("reject", req)}
                    disabled={processing === req.id}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve"
                ? "Approve Password Reset"
                : "Reject Password Reset"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve" ? (
                <>
                  This will apply the new password for{" "}
                  <strong>{confirmDialog.request?.userName}</strong> (
                  {confirmDialog.request?.userEmail}). They will be automatically
                  signed out and must log in with their new password.
                </>
              ) : (
                <>
                  This will reject the password reset request from{" "}
                  <strong>{confirmDialog.request?.userName}</strong> (
                  {confirmDialog.request?.userEmail}). They will need to submit
                  a new request.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                confirmDialog.action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {confirmDialog.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
