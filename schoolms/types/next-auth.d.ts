import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      /** TEACHER: the class group this teacher is assigned to */
      assignedClassId: string | null;
      /** STUDENT: the linked student profile id */
      linkedStudentId: string | null;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    assignedClassId?: string | null;
    linkedStudentId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    assignedClassId?: string | null;
    linkedStudentId?: string | null;
  }
}
