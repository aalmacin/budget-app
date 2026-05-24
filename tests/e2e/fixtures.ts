import { test as base, expect, type Page } from '@playwright/test';

type UserRole = 'A' | 'B';

interface UserCredentials {
  email: string;
  password: string;
}

function readCreds(role: UserRole): UserCredentials {
  const email = process.env[`E2E_USER_${role}_EMAIL`];
  const password = process.env[`E2E_USER_${role}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Missing E2E_USER_${role}_EMAIL or E2E_USER_${role}_PASSWORD. See .env.local.example.`
    );
  }
  return { email, password };
}

export async function loginAs(page: Page, role: UserRole): Promise<void> {
  const { email, password } = readCreds(role);
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.click('button[type="submit"]'),
  ]);
}

export const test = base;
export { expect, readCreds };
