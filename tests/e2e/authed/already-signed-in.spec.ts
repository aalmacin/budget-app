import { test, expect } from '../fixtures';

test.describe('US1 edge case — already-signed-in user revisits /login', () => {
  test('rendering /login while signed in does not crash', async ({ page }) => {
    await page.goto('/login');
    // The page must still render the sign-in heading without throwing.
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
