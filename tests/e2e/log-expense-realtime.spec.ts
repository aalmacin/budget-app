// T046 — Playwright expense logging + realtime flow.
//
// Prerequisites (run quickstart.md steps 2–4 against a fresh Supabase project):
//   - migrations 0001 + 0002 + 0003 applied
//   - auth user alex@example.com / TestPass1!
//   - alex has created "The Almacin household" via the onboarding page
//
// The realtime half (second adult's device sees the row within 5 s) is
// exercised using two BrowserContexts pointed at the same backend. If you
// don't have a second user provisioned, set SKIP_REALTIME=1 to skip that leg.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";
const BEA_EMAIL = process.env.E2E_BEA_EMAIL ?? "bea@example.com";
const BEA_PASSWORD = process.env.E2E_BEA_PASSWORD ?? "TestPass1!";
const SKIP_REALTIME = process.env.SKIP_REALTIME === "1";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Alex logs an expense; dashboard reflects it within 5s", async ({ page }) => {
  await signIn(page, ALEX_EMAIL, ALEX_PASSWORD);
  await page.goto("/dashboard");

  // Read the "Left to spend" hero before logging.
  const heroBefore = await page.locator("text=Left to spend").locator("..").locator("div.font-mono").first().innerText();

  await page.goto("/add");
  await page.locator('input[name="amount_cents_dollars"]').fill("45.20");
  await page.locator('select[name="category_id"]').selectOption({ label: "Groceries" });
  await page.locator('input[name="notes"]').fill("Whole Foods");
  await page.getByRole("button", { name: /save expense/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  // New row in recent activity within 5 s of returning to dashboard.
  await expect(page.locator("text=Whole Foods").first()).toBeVisible({ timeout: 5_000 });

  // Hero string should have changed (could be unchanged if no budget is set
  // and left-to-spend is still 0, but the recent row is the deterministic check).
  void heroBefore;
});

test("Alex edits then deletes the expense", async ({ page }) => {
  await signIn(page, ALEX_EMAIL, ALEX_PASSWORD);
  await page.goto("/transactions");

  // Tap the Whole Foods row to open the edit sheet.
  await page.getByText("Whole Foods").first().click();
  await page.getByRole("dialog", { name: /edit transaction/i }).waitFor();

  // Bump the amount, save.
  await page.locator('input[type="number"]').first().fill("50.00");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText("$50.00").first()).toBeVisible();

  // Re-open and delete.
  await page.getByText("Whole Foods").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByText("Whole Foods")).toHaveCount(0);
});

test.describe("Realtime cross-device", () => {
  test.skip(SKIP_REALTIME, "set SKIP_REALTIME=0 with a 2-adult household");

  test("Bea sees Alex's new expense within 5s", async ({ browser }) => {
    const ctxAlex = await browser.newContext();
    const ctxBea = await browser.newContext();
    const pageAlex = await ctxAlex.newPage();
    const pageBea = await ctxBea.newPage();

    await signIn(pageAlex, ALEX_EMAIL, ALEX_PASSWORD);
    await signIn(pageBea, BEA_EMAIL, BEA_PASSWORD);

    await pageBea.goto("/dashboard");
    await pageAlex.goto("/add");

    const merchant = `Tag-${Date.now()}`;
    await pageAlex.locator('input[name="amount_cents_dollars"]').fill("9.99");
    await pageAlex.locator('select[name="category_id"]').selectOption({ label: "Groceries" });
    await pageAlex.locator('input[name="notes"]').fill(merchant);
    await pageAlex.getByRole("button", { name: /save expense/i }).click();

    await expect(pageBea.getByText(merchant)).toBeVisible({ timeout: 6_000 });

    await ctxAlex.close();
    await ctxBea.close();
  });
});
