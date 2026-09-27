import { test, expect } from '@playwright/test';
import { createUserScene, deleteScenes, standDate, type UserScene } from '../helpers/stand';
import { SlotsPage } from '../pages/slots';

test.describe('Мои слоты', () => {
  let user: UserScene;
  let slots: SlotsPage;

  test.beforeEach(async ({ browser }) => {
    user = await createUserScene(browser, 'slots');
    slots = new SlotsPage(user.page);
    await slots.open();
  });

  test.afterEach(async () => {
    await deleteScenes(user);
  });

  test('Свободный слот можно удалить', async () => {
    await test.step('Добавляем свободный слот на завтра 12:00', async () => {
      await slots.addSlot(standDate(1), '12:00');
      await expect(slots.freeSlots).toBeVisible();
    });

    await test.step('Удаляем слот кнопкой «Удалить»', async () => {
      await slots.deleteFirstFreeSlot();
    });

    await test.step('После перезагрузки слота нет в списке', async () => {
      await slots.page.reload();
      await expect(slots.freeSlots).toHaveCount(0);
    });
  });
});
