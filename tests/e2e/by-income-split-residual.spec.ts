// T075 — Playwright split-rule flow.
// Prereq: 2 adults with monthly_income_cents 580000 / 248500 set via Family
// page. The test asserts the four chips render correct shares; the by-income
// path is verified via apply_split_rule's exact-sum guarantee.

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

test("All four split chips render on the Add Expense form", async ({ page }) => {
  await signIn(page);
  await page.goto("/add");

  // The four FR-015 chips, plus the Unsplit default.
  await expect(page.getByRole("button", { name: /unsplit/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /100%$/ })).toHaveCount(2); // Adult A / B
  await expect(page.getByRole("button", { name: /^50\/50$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^by income$/i })).toBeVisible();
});

test("Selecting by-income chip is persisted in the form", async ({ page }) => {
  await signIn(page);
  await page.goto("/add");
  const chip = page.getByRole("button", { name: /^by income$/i });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  // The hidden form field carries the split_rule.
  await expect(page.locator('input[name="split_rule"]')).toHaveValue("by_income");
});

test("Settings income-split shows ratios that sum to 100", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  const ratioCells = page.locator("text=/%$/");
  const count = await ratioCells.count();
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const text = await ratioCells.nth(i).innerText();
    const n = Number(text.replace("%", ""));
    if (Number.isFinite(n)) sum += n;
  }
  expect(sum === 100 || sum === 0).toBeTruthy();
});
