/**
 * T031 — Sign-in + household onboarding (US1 AC1, AC2, AC3, AC6)
 *
 * Covers:
 *   - FR-001: no signup form visible
 *   - FR-002: sign-in / sign-out
 *   - FR-003: user with no household_member row is routed to /onboarding/create-household
 *   - FR-003: cannot navigate to /dashboard before creating a household
 *   - FR-003: creating a household routes to /dashboard
 *   - US1 AC3: wrong credentials → error, stays on /login
 *   - US1 AC6: sign-out makes subsequent visits require re-authentication
 *
 * Pages: /login (T043), /onboarding/create-household (T044)
 *
 * Pre-condition: alex@example.com has NO household_member row.
 * This requires database cleanup between full test runs (manual or via
 * a seeded Supabase branch where Alex's membership has been removed).
 */

import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";

const ALEX = {
  email: "alex@example.com",
  password: process.env.E2E_ALEX_PASSWORD ?? "TestPass1!",
};

test.describe("Sign-in and household onboarding", () => {
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

  test("sign-in page has no signup form or public registration path", async () => {
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // FR-001: no signup link or form
    await expect(page.getByRole("link", { name: /sign up/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /register/i })).not.toBeVisible();
    await expect(page.getByRole("form", { name: /sign up/i })).not.toBeAttached();
  });

  test("wrong credentials show an error and stay on /login", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ALEX.email);
    await page.fill('input[name="password"]', "wrong-password-99!");
    await page.click('button[type="submit"]');

    await expect(page.getByText(/email or password is incorrect/i)).toBeVisible({
      timeout: 8000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("user with no household is redirected to /onboarding/create-household and cannot skip to /dashboard", async () => {
    // Verify the redirect happens automatically on sign-in
    await page.goto("/login");
    await page.fill('input[name="email"]', ALEX.email);
    await page.fill('input[name="password"]', ALEX.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/onboarding\/create-household/, {
      timeout: 10000,
    });

    // FR-003: cannot bypass onboarding by navigating directly to /dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/create-household/);
  });

  test("creating a household routes to /dashboard and persists across reload", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ALEX.email);
    await page.fill('input[name="password"]', ALEX.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/onboarding\/create-household/, {
      timeout: 10000,
    });

    const householdName = `The ${Date.now()} household`;
    await page.fill('input[name="householdName"]', householdName);
    await page.getByRole("button", { name: /create household/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Session persists across reload (FR-002)
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("sign-out makes subsequent visits redirect to /login", async () => {
    await page.goto("/login");
    await page.fill('input[name="email"]', ALEX.email);
    await page.fill('input[name="password"]', ALEX.password);
    await page.click('button[type="submit"]');

    // Wait for onboarding or dashboard depending on state
    await expect(page).toHaveURL(/\/(onboarding\/create-household|dashboard)/, {
      timeout: 10000,
    });

    // Open drawer and sign out (FR-002)
    await page.getByRole("button", { name: /menu|open navigation/i }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    // Confirm protected route now redirects
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
