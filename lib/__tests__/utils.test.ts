import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("passes through a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("joins two non-conflicting classes", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("resolves conflicting Tailwind classes to the last one", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});
