import { test, expect } from '@playwright/test';
import {
  deleteAccountViaApi,
  loginUser,
  makeUser,
  registerViaApi,
  ROUTES,
  type TestUser,
} from '../helpers/user';
import { SiteHeader } from '../pages/header';

test.describe('Вход и выход', () => {
  let user: TestUser;
  let header: SiteHeader;

  test.beforeEach(async ({ page }) => {
    user = makeUser('auth');
    await registerViaApi(page.context(), user);
    header = new SiteHeader(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteAccountViaApi(page.context()).catch(() => undefined);
  });

  test('Успешный вход держит сессию после перезагрузки', async ({ page }) => {
    await test.step('Входим через форму', async () => {
      await page.goto(ROUTES.login);
      await loginUser(page, user.email, user.password);
    });

    await test.step('Проверка: после перезагрузки сессия сохраняется', async () => {
      await page.reload();
      await expect(header.linkProfile).toBeVisible();
      await expect(header.btnLogout).toBeVisible();
    });

    await test.step('Проверка: после перезагрузки сессия сохраняется', async () => {
      await page.reload();
      await header.expectLoggedIn();
    });
  });

  test('Выход закрывает сессию', async ({ page }) => {
    await test.step('Входим через форму', async () => {
      await page.goto(ROUTES.login);
      await loginUser(page, user.email, user.password);
      await header.expectLoggedIn();
    });

    await test.step('Выходим', async () => {
      await header.btnLogout.click();
      await header.expectLoggedOut();
    });

    await test.step('Проверка: приватная страница больше недоступна', async () => {
      await page.goto(ROUTES.profile);
      await expect(page).toHaveURL(/auth\/login/);
    });

    await test.step('Возвращаем сессию для уборки', async () => {
      await page.goto(ROUTES.login);
      await loginUser(page, user.email, user.password);
      await header.expectLoggedIn();
    });
  });
});
