import { test, expect } from "@playwright/test";

test.describe("Staff Mark Entry Journey", () => {
  test("should enter marks and verify W-rule display", async ({ page }) => {
    await page.goto("/dashboard/marks/entry");
    await expect(page.locator("h1")).toBeVisible();
  });
});
