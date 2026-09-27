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

test.describe('Отмена: окно 2 часа до начала', () => {
  let host: HostScene;
  let guest: UserScene;
  let guestCatalog: CatalogPage;
  let guestBooking: BookingPage;

  test.beforeEach(async ({ browser }) => {
    // Слот через 90 минут — уже за границей окна «не позже чем за 2 часа до начала».
    host = await createHostWithSlot(browser, {
      skillTag: makeUnique('CancelWindow'),
      minutesAhead: 90,
    });
    guest = await createUserScene(browser, 'guest');

    guestCatalog = new CatalogPage(guest.page);
    guestBooking = new BookingPage(guest.page);
  });

  test.afterEach(async () => {
    await deleteScenes(guest, host);
  });

  test('Отмена запрещена позже чем за 2 часа до начала', async () => {
    await test.step('Гость: находит хоста по навыку и открывает карточку', async () => {
      await guestCatalog.goto();

      await expect(async () => {
        await guestCatalog.searchBy(host.skillTag);
        await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
      }).toPass({ timeout: 20_000 });
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Гость: выбирает свободный слот и подтверждает бронирование', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
      await guestBooking.confirmBooking();
    });

    await test.step('Проверка: бронирование подтверждено', async () => {
      await expect(guestBooking.modalSuccess).toBeVisible();
    });

    await test.step('Гость: открывает «Мои встречи» и жмёт «Отменить»', async () => {
      await guestBooking.openBookings();
      await guestBooking.cancelButtonFor(host.name).click();
    });

    await test.step('Проверка: редирект с причиной отказа', async () => {
      await expect(guest.page).toHaveURL(/cancelError=window/);
    });

    await test.step('Проверка: алерт — отмена доступна не позже чем за 2 часа', async () => {
      await expect(guestBooking.cancelRefusalAlert).toBeVisible();
    });

    await test.step('Проверка: встреча остаётся в «Ближайших»', async () => {
      await expect(guestBooking.upcomingBookings).toHaveCount(1);
    });

    await test.step('Проверка: в «Прошедших и отменённых» пусто', async () => {
      await expect(guestBooking.pastBookings).toHaveCount(0);
    });
  });
});
