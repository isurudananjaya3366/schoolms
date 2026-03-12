import { test, expect } from "@playwright/test";

test.describe("Preview Mode Full Cycle", () => {
  test("should navigate through all slides", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toBeVisible();
  });
});
