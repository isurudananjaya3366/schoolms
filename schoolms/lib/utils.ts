import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeMongoUri(message: string): string {
  return message.replace(
    /mongodb(\+srv)?:\/\/[^@]+@/gi,
    "mongodb$1://[credentials-redacted]@"
  );
}
