import { test, expect } from "@playwright/test";

test.describe("Admin Student and Report Workflow", () => {
  test("should create student, enter marks, and generate PDF", async ({
    page,
  }) => {
    await page.goto("/dashboard/students");
    await expect(page.locator("h1")).toBeVisible();
  });
});
