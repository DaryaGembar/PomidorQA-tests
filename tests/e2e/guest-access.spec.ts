import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { makeUnique, ROUTES } from '../helpers/user';
import { createHostWithSlot, deleteScenes, type HostScene } from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';
import { BookingPage } from '../pages/booking';

test.describe('Гость: возможности неавторизованного пользователя', () => {
  let host: HostScene;
  let guestContext: BrowserContext;
  let guestPage: Page;
  let guestCatalog: CatalogPage;
  let guestBooking: BookingPage;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, { skillTag: makeUnique('GuestAccess') });

    // Гость неавторизован — контекст без аккаунта.
    guestContext = await browser.newContext();
    guestPage = await guestContext.newPage();
    guestCatalog = new CatalogPage(guestPage);
    guestBooking = new BookingPage(guestPage);

    await expect(async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(host.skillTag);
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    }).toPass({ timeout: 20_000 });
    await expect(guestCatalog.personCard).toHaveCount(1);
  });

  test.afterEach(async () => {
    await deleteScenes(host);
    await guestContext.close();
  });

  test('Гость видит карточку участника в каталоге', async () => {
    await test.step('В каталоге видна карточка хоста', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    });

    await test.step('В выдаче по навыку ровно одна карточка', async () => {
      await expect(guestCatalog.personCard).toHaveCount(1);
    });
  });

  test('Гость открывает карточку участника и видит слоты', async () => {
    await test.step('Гость открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыта страница участника: имя хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });

    await test.step('На странице видны свободные слоты', async () => {
      await guestBooking.waitForFreeSlot();
    });
  });

  test('Гость не может забронировать слот', async () => {
    await test.step('Гость открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Гость выбирает свободный слот', async () => {
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
    });

    await test.step('Подтверждение требует войти в аккаунт', async () => {
      await guestBooking.confirmBookingAsGuest();
    });

    await test.step('После попытки слот остаётся свободным', async () => {
      await expect(async () => {
        await guestPage.reload();
        await expect(guestBooking.calendarDay.first()).toBeVisible();
      }).toPass({ timeout: 15_000 });
    });
  });

  test('Приватные страницы недоступны гостю', async () => {
    await test.step('Гость открывает /profile', async () => {
      await guestPage.goto(ROUTES.profile);
    });

    await test.step('Редирект на страницу логина', async () => {
      await expect(guestPage).toHaveURL(/auth\/login/);
    });

    await test.step('Гость открывает /profile/slots', async () => {
      await guestPage.goto(ROUTES.slots);
    });

    await test.step('Редирект на страницу логина', async () => {
      await expect(guestPage).toHaveURL(/auth\/login/);
    });

    await test.step('Гость открывает /bookings', async () => {
      await guestPage.goto(ROUTES.bookings);
    });

    await test.step('Редирект на страницу логина', async () => {
      await expect(guestPage).toHaveURL(/auth\/login/);
    });
  });
});
