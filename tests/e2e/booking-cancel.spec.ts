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

test.describe('Мои встречи: отмена брони', () => {
  let host: HostScene;
  let guest: UserScene;
  let hostBooking: BookingPage;
  let guestCatalog: CatalogPage;
  let guestBooking: BookingPage;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, { skillTag: makeUnique('Cancel') });
    guest = await createUserScene(browser, 'guest');

    hostBooking = new BookingPage(host.page);
    guestCatalog = new CatalogPage(guest.page);
    guestBooking = new BookingPage(guest.page);

    await guestCatalog.goto();
  });

  test.afterEach(async () => {
    await deleteScenes(guest, host);
  });

  test('Забронированный слот удалить нельзя', async () => {
    let guestResult: 'success' | 'taken';

    await test.step('Гость: открывает каталог и ищет хоста по навыку (сценарий 9)', async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(host.skillTag);
    });

    await test.step('Карточка хоста найдена в каталоге', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    });

    await test.step('Гость: открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыта карточка хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });

    await test.step('Гость кликает по дню и времени слота', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
    });

    await test.step('Гость: подтверждает бронирование', async () => {
      guestResult = await guestBooking.confirmBooking();
    });

    await test.step('Бронирование гостя подтверждено', async () => {
      expect(guestResult).toBe('success');
    });

    await test.step('Хост: видит бронирование в разделе «Мои встречи»', async () => {
      await expect(async () => {
        await hostBooking.openBookings();
        await expect(hostBooking.upcomingSession).toContainText(guest.name);
      }).toPass({ timeout: 15_000 });
    });

    await test.step('Хост: заходит на страницу «Мои слоты»', async () => {
      await host.slots.open();
    });

    await test.step('Слот отображается как забронированный', async () => {
      await expect(async () => {
        await host.slots.open();
        await expect(host.slots.slotRow('booked')).toContainText('забронирован');
      }).toPass({ timeout: 15_000 });
    });

    await test.step('У забронированного слота нет кнопки удаления', async () => {
      await expect(host.slots.slotRow('booked').getByRole('button')).toHaveCount(0);
    });

    await test.step('После перезагрузки слот всё ещё забронирован', async () => {
      await host.page.reload();
      await expect(host.slots.slotRow('booked')).toContainText('забронирован');
    });
  });

  test('отменённая встреча уходит в «Прошедшие и отменённые» — её видят гость и хост после перезагрузки', async () => {
    let guestResult: 'success' | 'taken';
    let cancelResult: 'cancelled' | 'not-found';

    await test.step('Гость: ищет хоста в каталоге по навыку', async () => {
      await guestCatalog.searchBy(host.skillTag);
    });

    await test.step('Карточка хоста найдена в каталоге', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    });

    await test.step('Гость: открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыта карточка хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });

    await test.step('Гость: кликает по дню и времени в календаре слотов', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
    });

    await test.step('Гость: подтверждает бронирование', async () => {
      guestResult = await guestBooking.confirmBooking();
    });

    await test.step('Бронирование гостя подтверждено — слот достался ему', async () => {
      expect(guestResult).toBe('success');
    });

    await test.step('Гость: видит бронирование в разделе «Мои встречи»', async () => {
      await expect(async () => {
        await guestBooking.openBookings();
        await expect(guestBooking.upcomingSession).toContainText(host.name);
      }).toPass({ timeout: 15_000 });
    });

    await test.step('Гость: отменяет встречу с хостом', async () => {
      cancelResult = await guestBooking.cancelBookingWith(host.name);
    });

    await test.step('Встреча гостя отменена', async () => {
      expect(cancelResult).toBe('cancelled');
    });

    await test.step('После перезагрузки у гостя встреча в «Прошедшие и отменённые»', async () => {
      await guest.page.reload();
      await expect(guestBooking.upcomingBookingWith(host.name)).toHaveCount(0);
      await expect(guestBooking.cancelledSection).toBeVisible();
      await expect(guestBooking.pastBookingWith(host.name)).toContainText('отменено');
    });

    await test.step('После перезагрузки у хоста встреча в «Прошедшие и отменённые»', async () => {
      await expect(async () => {
        await hostBooking.openBookings();
        await host.page.reload();
        await expect(hostBooking.upcomingBookingWith(guest.name)).toHaveCount(0);
        await expect(hostBooking.cancelledSection).toBeVisible();
        await expect(hostBooking.pastBookingWith(guest.name)).toContainText('отменено');
      }).toPass({ timeout: 15_000 });
    });
  });

  test('Хост отменяет встречу — слот снова свободен и бронируется', async () => {
    let guestResult: 'success' | 'taken';
    let cancelResult: 'cancelled' | 'not-found';

    await test.step('Гость: находит хоста и бронирует слот', async () => {
      await guestCatalog.searchBy(host.skillTag);
      await guestCatalog.getPersonCard(host.name).click();
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
      guestResult = await guestBooking.confirmBooking();
    });

    await test.step('Проверка: бронь подтверждена', async () => {
      expect(guestResult).toBe('success');
    });

    await test.step('Хост: видит бронирование в «Мои встречи»', async () => {
      await expect(async () => {
        await hostBooking.openBookings();
        await expect(hostBooking.upcomingSession).toContainText(guest.name);
      }).toPass({ timeout: 15_000 });
    });

    await test.step('Хост: отменяет встречу с гостем', async () => {
      cancelResult = await hostBooking.cancelBookingWith(guest.name);
    });

    await test.step('Проверка: отмена хостом прошла — R11.1', async () => {
      expect(cancelResult).toBe('cancelled');
    });

    await test.step('Гость: открывает «Мои встречи»', async () => {
      await guestBooking.openBookings();
    });

    await test.step('После перезагрузки у гостя встреча в «Прошедшие и отменённые»', async () => {
      await expect(async () => {
        await guestBooking.openBookings();
        await expect(guestBooking.upcomingBookingWith(host.name)).toHaveCount(0);
        await expect(guestBooking.pastBookingWith(host.name)).toContainText('отменено');
      }).toPass({ timeout: 15_000 });
    });

    await test.step('Хост: слот снова свободен в «Мои слоты» — R11.3', async () => {
      await expect(async () => {
        await host.slots.open();
        await expect(host.slots.slotRow('free')).toContainText('12:00');
      }).toPass({ timeout: 15_000 });
    });

    await test.step('Гость: бронирует освобождённый слот повторно', async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(host.skillTag);
      await guestCatalog.getPersonCard(host.name).click();
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
      guestResult = await guestBooking.confirmBooking();
    });

    await test.step('Проверка: слот достался гостю повторно', async () => {
      expect(guestResult).toBe('success');
    });
  });
});
