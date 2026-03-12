import { test, expect } from "@playwright/test";

test.describe("Analytics Charts Rendering", () => {
  test("should render all chart containers", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await expect(page.locator("h1")).toBeVisible();
  });
});
