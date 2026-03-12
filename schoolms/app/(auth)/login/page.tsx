import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Sign In — SchoolMS",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const passwordResetSuccess = params.passwordReset === "success";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access SchoolMS
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwordResetSuccess && (
            <Alert className="mb-4">
              <AlertDescription>
                Your password has been reset successfully. Please sign in with
                your new password.
              </AlertDescription>
            </Alert>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
