import { test, expect, type BrowserContext } from '@playwright/test';
import {
  deleteAccountViaApi,
  loginUser,
  makeUnique,
  makeUser,
  registerViaApi,
  ROUTES,
  type TestUser,
} from '../helpers/user';
import { SiteHeader } from '../pages/header';

test.describe('Вход и выход', () => {
  let user: TestUser;
  let header: SiteHeader;
  let cleanupContext: BrowserContext;

  test.beforeEach(async ({ browser, page }) => {
    user = makeUser(makeUnique('auth'));
    cleanupContext = await browser.newContext();
    await registerViaApi(cleanupContext, user);
    header = new SiteHeader(page);
  });

  test.afterEach(async () => {
    await deleteAccountViaApi(cleanupContext).catch(() => undefined);
    await cleanupContext.close();
  });

  test('Успешный вход держит сессию после перезагрузки', async ({ page }) => {
    await test.step('Входим через форму', async () => {
      await page.goto(ROUTES.login);
      await loginUser(page, user.email, user.password);
      await header.expectLoggedIn();
    });

    await test.step('Проверка: после перезагрузки сессия сохраняется', async () => {
      await page.reload();
      await header.expectLoggedIn();
      await expect(page).not.toHaveURL(/auth\/login/);
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
  });
});
