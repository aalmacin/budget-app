// T069 — Family-aware tagging + essential/treats split.
//
// Prereq: alex@example.com signed in, household has at least one kid named
// "Mia" (see signin-onboarding.spec.ts or seed manually).

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

test("Tag an expense for a kid with 75/25 essential split", async ({ page }) => {
  await signIn(page);
  await page.goto("/add");

  await page.locator('input[name="amount_cents_dollars"]').fill("100.00");
  await page.locator('select[name="category_id"]').selectOption({ label: "Groceries" });
  await page.locator('input[name="notes"]').fill(`Tagged-${Date.now()}`);

  // Tap the kid's "For whom" chip.
  await page.getByRole("button", { name: /^mia$/i }).click();

  // Move the essential split slider to 75 (snap target).
  const slider = page.locator('input[type="range"][aria-label="Essential percent"]');
  await slider.fill("75");

  await page.getByRole("button", { name: /save expense/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Dashboard essential/treats card reflects the split.
  await expect(page.getByText("Essential vs treats")).toBeVisible();
});
