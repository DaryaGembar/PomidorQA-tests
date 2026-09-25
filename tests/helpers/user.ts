import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';

export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export const ROUTES = {
  register: '/pomidorqa/auth/register',
  login: '/pomidorqa/auth/login',
  catalog: '/pomidorqa',
  profile: '/pomidorqa/profile',
  slots: '/pomidorqa/profile/slots',
  bookings: '/pomidorqa/bookings',
  testAccounts: '/api/pomidorqa/test/accounts',
};

export function makeUser(role: string): TestUser {
  return {
    name: `${role} Автотест`,
    email: `${makeUnique(role)}@example.com`,
    password: 'testpass123',
  };
}

export function makeUnique(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}
export async function registerUser(page: Page, user: TestUser) {
  await expect(async () => {
    await page.goto(ROUTES.register);
    await page.getByLabel('Имя').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Пароль').fill(user.password);
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    const emailTaken = await page
      .getByText('Этот email уже зарегистрирован')
      .isVisible()
      .catch(() => false);
    if (emailTaken) {
      await loginUser(page, user.email, user.password);
    }
    await expect(page).toHaveURL(/\/pomidorqa\/?$/, { timeout: 8_000 });
  }).toPass({ timeout: 25_000 });
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto(ROUTES.login);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

// Стенд иногда отвечает 502 через nginx (кратковременная потеря upstream) —
// ретраим 5xx и 429: повтор инфраструктурного сбоя исправляет ситуацию.
// Оставшиеся 4xx не ретраим: конфликт или ошибка данных повтором не лечится.
async function withRetries<T>(
  expectedStatuses: number[],
  operation: () => Promise<{ status: number; payload: T }>,
): Promise<T> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await operation();
    lastStatus = response.status;
    if (expectedStatuses.includes(response.status)) {
      return response.payload;
    }
    if (response.status < 500 && response.status !== 429) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  throw new Error(`API-запрос к стенду не удался: HTTP ${lastStatus}`);
}

export async function registerViaApi(
  context: BrowserContext,
  user: TestUser,
): Promise<{ id: string }> {
  return withRetries([201], async () => {
    const response = await context.request.post(ROUTES.testAccounts, {
      data: { name: user.name, email: user.email, password: user.password },
    });
    return { status: response.status(), payload: (await response.json()) as { id: string } };
  });
}

export async function deleteAccountViaApi(context: BrowserContext) {
  await withRetries([200], async () => {
    const response = await context.request.delete(ROUTES.testAccounts);
    return { status: response.status(), payload: undefined };
  });
}
