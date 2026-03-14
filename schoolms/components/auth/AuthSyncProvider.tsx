"use client";

/**
 * AuthSyncProvider
 *
 * Implements the three-tier client-side auth storage strategy:
 *
 *   1. Secure HttpOnly cookies  - access token (managed by NextAuth, unchanged here)
 *   2. sessionStorage           - role + sessionId (cleared when tab/browser closes)
 *   3. localStorage             - user profile (name, email, role) for UI display
 *
 * Mount this once in the root layout inside a <SessionProvider>.
 * It syncs automatically on session changes and clears storage on logout.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";

// ─── Storage keys ─────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "sms_session";
const LOCAL_STORAGE_KEY = "sms_profile";

export interface StoredSession {
  role: string;
  sessionId: string;   // derived from user id + iat estimate
  assignedClassId: string | null;
  linkedStudentId: string | null;
  syncedAt: number;
}

export interface StoredProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  syncedAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function writeSessionStorage(data: StoredSession) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable in certain browser contexts
  }
}

function writeLocalStorage(data: StoredProfile) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private mode, storage full, etc.)
  }
}

function clearAuthStorage() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* ignore */ }
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch { /* ignore */ }
}

// ─── Public helpers for consuming stored data ────────────────────

export function getStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getStoredProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function AuthSyncProvider() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user) {
      clearAuthStorage();
      return;
    }

    const user = session.user;
    const now = Date.now();

    // sessionStorage: role + class/student bindings (ephemeral)
    const sessionData: StoredSession = {
      role: user.role,
      sessionId: `${user.id}:${now}`,
      assignedClassId: user.assignedClassId,
      linkedStudentId: user.linkedStudentId,
      syncedAt: now,
    };
    writeSessionStorage(sessionData);

    // localStorage: display profile (non-sensitive, persists across tabs)
    const profileData: StoredProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      syncedAt: now,
    };
    writeLocalStorage(profileData);
  }, [session, status]);

  // Renders nothing - purely side-effect driven
  return null;
}
