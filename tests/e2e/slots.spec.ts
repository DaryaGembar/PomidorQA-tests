import { test, expect } from '@playwright/test';
import { deleteAccountViaApi, makeUser, registerViaApi, type TestUser } from '../helpers/user';
import { SlotsPage } from '../pages/slots';

test.describe('Мои слоты', () => {
  let user: TestUser;
  let slots: SlotsPage;

  test.beforeEach(async ({ page }) => {
    user = makeUser('slots');
    await registerViaApi(page.context(), user);
    slots = new SlotsPage(page);
    await slots.open();
  });

  test.afterEach(async ({ page }) => {
    await deleteAccountViaApi(page.context()).catch(() => undefined);
  });

  test('Свободный слот можно удалить', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await test.step('Добавляем свободный слот на завтра 12:00', async () => {
      await slots.addSlot(tomorrow, '12:00');
      await expect(slots.freeSlots).toBeVisible();
    });

    await test.step('Удаляем слот кнопкой «Удалить»', async () => {
      await slots.deleteFirstFreeSlot();
    });

    await test.step('После перезагрузки слота нет в списке', async () => {
      await page.reload();
      await expect(slots.freeSlots).toHaveCount(0);
    });
  });
});
