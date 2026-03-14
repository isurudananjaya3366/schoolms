import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          const { email, password } = parsed.data;

          const { default: prisma } = await import("@/lib/prisma");
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              passwordHash: true,
              assignedClassId: true,
              linkedStudentId: true,
            },
          });

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return null;
          }

          // Check if account is deactivated
          if (user.isActive === false) {
            throw new Error("AccountDeactivated");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            assignedClassId: user.assignedClassId ?? null,
            linkedStudentId: user.linkedStudentId ?? null,
          };
        } catch (error) {
          if (error instanceof Error && error.message === "AccountDeactivated") {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, persist user data into token
      if (user) {
        token.userId = user.id!;
        token.email = user.email!;
        token.name = user.name!;
        token.role = user.role;
        token.assignedClassId = user.assignedClassId ?? null;
        token.linkedStudentId = user.linkedStudentId ?? null;
      }

      // Auto-refresh: extend 8h when <2h remaining
      const now = Math.floor(Date.now() / 1000);
      const iat = (token.iat as number) || now;
      const eightHours = 8 * 60 * 60;
      const twoHours = 2 * 60 * 60;
      const exp = iat + eightHours;

      if (exp - now < twoHours) {
        token.iat = now;
      }

      // Session invalidation check (once per hour)
      const lastCheck = (token.lastInvalidationCheck as number) || 0;
      const oneHour = 60 * 60;

      if (now - lastCheck > oneHour && token.userId) {
        try {
          const { default: prisma } = await import("@/lib/prisma");
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId },
            select: { sessionInvalidatedAt: true },
          });

          if (dbUser?.sessionInvalidatedAt) {
            const invalidatedAt = Math.floor(
              dbUser.sessionInvalidatedAt.getTime() / 1000
            );
            if (invalidatedAt > iat) {
              // Session was invalidated - return empty token to force re-auth
              return {} as typeof token;
            }
          }

          token.lastInvalidationCheck = now;
        } catch {
          // Guard against Edge runtime or DB unavailability
          // Silently continue with existing token
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role;
        session.user.assignedClassId = token.assignedClassId ?? null;
        session.user.linkedStudentId = token.linkedStudentId ?? null;
      }
      return session;
    },
  },
});
