import { test, expect, readCreds, loginAs } from '../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('US1 — sign-in flow (anonymous)', () => {
  test('anonymous visitor is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('valid credentials sign in and land on /', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page).toHaveURL('/');
    // Authenticated home shows the user's email (FR-020).
    const { email } = readCreds('A');
    await expect(page.getByText(email)).toBeVisible();
  });

  test('invalid credentials keep user on /login with error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'someone@example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByTestId('login-error')).toHaveText(/Invalid credentials/i);
    // Password input is reset (the form re-renders on the new request).
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  });

  test('empty form does not submit (HTML required validation)', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // URL must not have changed to a redirect — the browser blocks submission.
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
  });
});

test.describe('US1 — session persistence', () => {
  test('session persists across reload', async ({ page }) => {
    await loginAs(page, 'A');
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(page).toHaveURL('/');
    const { email } = readCreds('A');
    await expect(page.getByText(email)).toBeVisible();
  });
});
