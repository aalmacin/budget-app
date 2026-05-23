// T082 — Budget overview flow.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Set Groceries monthly limit to $800 via edit sheet", async ({ page }) => {
  await signIn(page);
  await page.goto("/budget");

  // Tap the Groceries row to open the edit-limit sheet.
  await page.getByText("Groceries", { exact: true }).click();
  await page.getByRole("dialog", { name: /edit monthly limit/i }).waitFor();
  await page.locator('input[type="number"]').first().fill("800");
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(page.getByText("/$800.00/")).toBeVisible({ timeout: 5_000 });
});

test("All / Essential / Treats filter chips toggle", async ({ page }) => {
  await signIn(page);
  await page.goto("/budget");

  await page.getByRole("button", { name: /essential/i }).click();
  await expect(page.getByRole("button", { name: /essential/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: /treats/i }).click();
  await expect(page.getByRole("button", { name: /treats/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Clear-limit edge case (blank input)", async ({ page }) => {
  await signIn(page);
  await page.goto("/budget");
  await page.getByText("Groceries", { exact: true }).click();
  await page.locator('input[type="number"]').first().fill("");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText("No monthly limit set").first()).toBeVisible({ timeout: 5_000 });
});
