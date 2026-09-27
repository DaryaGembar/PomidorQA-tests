import { test, expect } from '@playwright/test';
import { makeUnique } from '../helpers/user';
import {
  createHostWithSlot,
  createUserScene,
  deleteScenes,
  type HostScene,
  type UserScene,
} from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';
import { BookingPage } from '../pages/booking';

test.describe('Состояние бронирования: окно подтверждения и календарь участника', () => {
  let host: HostScene;
  let guest: UserScene;
  let guestCatalog: CatalogPage;
  let guestBooking: BookingPage;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, { skillTag: makeUnique('BookingState') });
    guest = await createUserScene(browser, 'guest');

    guestCatalog = new CatalogPage(guest.page);
    guestBooking = new BookingPage(guest.page);

    await expect(async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(host.skillTag);
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    }).toPass({ timeout: 20_000 });
    await expect(guestCatalog.personCard).toHaveCount(1);
  });

  test.afterEach(async () => {
    await deleteScenes(guest, host);
  });

  test('Закрытие окна подтверждения не создаёт бронь', async () => {
    await test.step('Гость: открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыта карточка хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });

    await test.step('Гость выбирает свободный слот', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
    });

    await test.step('Гость: закрывает окно подтверждения кнопкой «Отмена»', async () => {
      await guestBooking.cancelConfirmDialog();
    });

    await test.step('Окно подтверждения закрылось', async () => {
      await expect(guestBooking.confirmModalDialog).toBeHidden();
    });

    await test.step('Окно успеха не появлялось', async () => {
      await expect(guestBooking.modalSuccess).toHaveCount(0);
    });

    await test.step('Гость перезагружает страницу участника', async () => {
      await guest.page.reload();
    });

    await test.step('Слот всё ещё свободен', async () => {
      await guestBooking.waitForFreeSlot();
    });

    await test.step('Гость: заходит в «Мои встречи»', async () => {
      await guestBooking.openBookings();
    });

    await test.step('В «Мои встречи» гостя бронирований нет', async () => {
      await expect(guestBooking.upcomingSession).toContainText('Пока пусто', {
        timeout: 15_000,
      });
      await expect(guestBooking.upcomingBookings).toHaveCount(0);
    });
  });

  test('Забронированный слот исчезает со страницы участника', async () => {
    let guestResult: 'success' | 'taken';

    await test.step('Гость: открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыта карточка хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });

    await test.step('Гость выбирает свободный слот', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
    });

    await test.step('Гость: подтверждает бронирование', async () => {
      guestResult = await guestBooking.confirmBooking();
    });

    await test.step('Бронирование гостя подтверждено', async () => {
      expect(guestResult).toBe('success');
    });

    await test.step('Гость перезагружает страницу участника', async () => {
      await guest.page.reload();
    });

    await test.step('Календарь участника опустел — свободных слотов нет', async () => {
      await expect(async () => {
        await guest.page.reload();
        await expect(guestBooking.calendarDay).toHaveCount(0);
        await expect(guestBooking.calendarTime).toHaveCount(0);
      }).toPass({ timeout: 15_000 });
    });
  });
});
