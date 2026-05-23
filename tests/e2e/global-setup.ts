import { chromium, type FullConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const STORAGE_PATH = 'tests/e2e/.auth/userA.json';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3023';
  const email = process.env.E2E_USER_A_EMAIL;
  const password = process.env.E2E_USER_A_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_A_EMAIL and E2E_USER_A_PASSWORD must be set. See .env.local.example.'
    );
  }

  await mkdir(dirname(STORAGE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.click('button[type="submit"]'),
  ]);

  await context.storageState({ path: STORAGE_PATH });
  await browser.close();
}
