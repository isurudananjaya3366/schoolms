"use client";

import { SessionProvider } from "next-auth/react";
import AuthSyncProvider from "@/components/auth/AuthSyncProvider";

/**
 * Client boundary wrapper for the root layout.
 * Provides the NextAuth session context and syncs auth state
 * to sessionStorage / localStorage via AuthSyncProvider.
 */
export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AuthSyncProvider />
      {children}
    </SessionProvider>
  );
}
