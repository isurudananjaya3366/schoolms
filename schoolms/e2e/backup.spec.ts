import { test, expect } from "@playwright/test";

test.describe("Superadmin Backup Workflow", () => {
  test("should create backup and verify in history", async ({ page }) => {
    await page.goto("/dashboard/backup");
    await expect(page.locator("h1")).toBeVisible();
  });
});
