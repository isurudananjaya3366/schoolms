import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // /api/config/health — always public
  if (pathname === "/api/config/health") {
    return NextResponse.next();
  }

  // /api/auth/* — pass through (NextAuth handles these)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // /config path logic
  if (pathname === "/config") {
    const dbConfigured = process.env.NEXT_PUBLIC_DB_CONFIGURED;
    if (dbConfigured !== "true") {
      return NextResponse.next(); // unconfigured: allow public access
    }
    // DB configured: require auth
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        encodeURIComponent(pathname)
      );
      return NextResponse.redirect(loginUrl);
    }
    // DB configured + session: require SUPERADMIN
    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // /student/view/* and /student (root) — public student portal, no auth required
  if (pathname === "/student" || pathname.startsWith("/student/view")) {
    return NextResponse.next();
  }

  // /student/* — require authentication; only STUDENT role allowed
  if (pathname.startsWith("/student")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        encodeURIComponent(pathname + req.nextUrl.search)
      );
      return NextResponse.redirect(loginUrl);
    }
    // Non-students are redirected to the dashboard
    if (session.user.role !== "STUDENT") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // /dashboard/* — require authentication
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        encodeURIComponent(pathname + req.nextUrl.search)
      );
      return NextResponse.redirect(loginUrl);
    }
    // STUDENT role is not allowed in the dashboard — redirect to student portal
    if (session.user.role === "STUDENT") {
      return NextResponse.redirect(new URL("/student/profile", req.url));
    }
    return NextResponse.next();
  }

  // /api/* (excluding already handled paths) — require auth, return 401 JSON
  // Public exceptions: /api/student/lookup and /api/student/[indexNumber]
  if (
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/student")
  ) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*", "/api/:path*", "/config"],
};
