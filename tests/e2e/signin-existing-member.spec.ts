/**
 * T032 — Sign-in as existing household member (US1 AC4)
 *
 * Covers:
 *   - FR-002: sign-in
 *   - FR-003: user WITH an active household_member row goes directly to /dashboard,
 *             no onboarding redirect (the "Bea case")
 *
 * Pages: /login (T043), /dashboard (T057)
 *
 * Pre-condition: bea@example.com already has an active household_member row
 * (either seeded, or Alex has added Bea via add_adult_by_email before this
 * suite runs). The test suite for T033 creates that membership, so run T033
 * before this suite when running against a fresh DB.
 */

import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";

const BEA = {
  email: "bea@example.com",
  password: process.env.E2E_BEA_PASSWORD ?? "TestPass1!",
};

test.describe("Sign-in as existing household member", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser: b }) => {
    browser = b;
    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("existing member lands on /dashboard without onboarding redirect", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', BEA.email);
    await page.fill('input[name="password"]', BEA.password);
    await page.click('button[type="submit"]');

    // FR-003: active household_member → no redirect to onboarding
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/onboarding/);
  });

  test("existing member session persists across reload", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', BEA.email);
    await page.fill('input[name="password"]', BEA.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("existing member sign-out clears session", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', BEA.email);
    await page.fill('input[name="password"]', BEA.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    await page.getByRole("button", { name: /menu|open navigation/i }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
