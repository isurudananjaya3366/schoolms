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
import { GraduationCap, Megaphone } from "lucide-react";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Sign In - SchoolMS",
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

  // Load school branding (graceful - if DB is unreachable, fallback to defaults)
  let schoolName = "SchoolMS";
  let schoolLogoUrl: string | null = null;
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ["school_name", "school_logo_url"] } },
      select: { key: true, value: true },
    });
    const map = Object.fromEntries(configs.map(c => [c.key, c.value]));
    if (map.school_name) schoolName = map.school_name;
    if (map.school_logo_url) schoolLogoUrl = map.school_logo_url;
  } catch {
    // Silently use defaults if DB is unavailable (e.g. during initial setup)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              {schoolLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={schoolLogoUrl}
                  alt={`${schoolName} logo`}
                  className="h-10 w-10 rounded-lg object-contain"
                />
              ) : (
                <GraduationCap className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-center text-2xl">{schoolName}</CardTitle>
          <CardDescription className="text-center">Sign in to your account</CardDescription>
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
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="staff">Staff / Admin</TabsTrigger>
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="notices">Notice Board</TabsTrigger>
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
            <TabsContent value="notices">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Megaphone className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  View the latest school announcements, events, and important
                  notices published by administration.
                </p>
                <Button asChild className="w-full">
                  <Link href="/notices">View Notice Board</Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
