import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

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
            Sign in to SchoolMS
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
          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="staff">Staff / Admin</TabsTrigger>
              <TabsTrigger value="student">Student</TabsTrigger>
            </TabsList>
            <TabsContent value="staff">
              <LoginForm />
            </TabsContent>
            <TabsContent value="student">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Students don&apos;t need a password. Enter your name or index
                  number on the student portal to view your profile and marks.
                </p>
                <Button asChild className="w-full">
                  <Link href="/student">Go to Student Portal</Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
