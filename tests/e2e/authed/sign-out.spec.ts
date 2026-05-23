import { test, expect, readCreds } from '../fixtures';

test.describe('US3 — sign out and shell', () => {
  test('header shows the signed-in user email and a Sign out button', async ({ page }) => {
    await page.goto('/');
    const { email } = readCreds('A');
    await expect(page.getByTestId('current-user-email')).toHaveText(email);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('Sign out ends the session and redirects to /login', async ({ page }) => {
    await page.goto('/');
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/login'),
      page.getByRole('button', { name: 'Sign out' }).click(),
    ]);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('after sign out, protected pages redirect to /login', async ({ page }) => {
    await page.goto('/');
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/login'),
      page.getByRole('button', { name: 'Sign out' }).click(),
    ]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('US3 edge case — multi-tab sign-out propagates', () => {
  // Two pages in the same browser context share a cookie store, which mirrors
  // multiple tabs of the same browser profile. Signing out in page1 must cause
  // page2's next protected request to redirect.
  test('signing out in tab A redirects tab B on next request', async ({ context, page }) => {
    const page1 = page;
    const page2 = await context.newPage();

    await page1.goto('/');
    await page2.goto('/');
    await expect(page1).toHaveURL('/');
    await expect(page2).toHaveURL('/');

    await Promise.all([
      page1.waitForURL((url) => url.pathname === '/login'),
      page1.getByRole('button', { name: 'Sign out' }).click(),
    ]);

    // Tab B is still on the protected page; its next request must redirect.
    await page2.reload();
    await expect(page2).toHaveURL(/\/login$/);

    await page2.close();
  });
});
