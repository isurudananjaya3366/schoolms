import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Reset Password — SchoolMS",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode || "request";

  if (mode === "reset") {
    const { token, email } = params;

    if (!token || !email) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  This password reset link is invalid. Please request a new one.
                </AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full">
                <Link href="/reset-password?mode=request">
                  Request New Link
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Validate token: check user exists and token hasn't expired
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordResetExpiry: true, passwordResetToken: true },
    });

    const isValid =
      user &&
      user.passwordResetToken &&
      user.passwordResetExpiry &&
      new Date(user.passwordResetExpiry) > new Date();

    if (!isValid) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">Link Expired</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  This password reset link has expired or is invalid. Please
                  request a new one.
                </AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full">
                <Link href="/reset-password?mode=request">
                  Request New Link
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm token={token} email={email} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: request mode
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
