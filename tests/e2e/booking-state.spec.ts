import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  deleteAccountViaApi,
  makeUnique,
  makeUser,
  registerViaApi,
  type TestUser,
} from '../helpers/user';
import { CatalogPage } from '../pages/catalog';
import { ProfilePage } from '../pages/profile';
import { SlotsPage } from '../pages/slots';
import { BookingPage } from '../pages/booking';

test.describe('Состояние бронирования: окно подтверждения и календарь участника', () => {
  let host: TestUser;
  let guest: TestUser;
  let skillTag: string;
  let hostContext: BrowserContext;
  let guestContext: BrowserContext;
  let hostPage: Page;
  let guestPage: Page;
  let guestCatalog: CatalogPage;
  let guestBooking: BookingPage;

  test.beforeEach(async ({ browser }) => {
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();

    host = makeUser('host');
    guest = makeUser('guest');
    skillTag = makeUnique('BookingState');

    await registerViaApi(hostContext, host);
    await registerViaApi(guestContext, guest);

    const hostProfile = new ProfilePage(hostPage);
    const hostSlots = new SlotsPage(hostPage);
    await hostProfile.open();
    await hostProfile.addSkill(skillTag);
    await expect(hostProfile.canHelpSkills).toContainText(skillTag);

    await hostSlots.open();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await hostSlots.addSlot(tomorrow.toISOString().slice(0, 10), '12:00');
    await expect(hostSlots.freeSlots).toBeVisible();

    guestCatalog = new CatalogPage(guestPage);
    guestBooking = new BookingPage(guestPage);

    await expect(async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(skillTag);
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    }).toPass({ timeout: 20_000 });
    await expect(guestCatalog.personCard).toHaveCount(1);
  });

  test.afterEach(async () => {
    await deleteAccountViaApi(guestContext).catch(() => undefined);
    await deleteAccountViaApi(hostContext).catch(() => undefined);
    await guestContext.close();
    await hostContext.close();
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
      await guestPage.reload();
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
      await guestPage.reload();
    });

    await test.step('Календарь участника опустел — свободных слотов нет', async () => {
      await expect(async () => {
        await guestPage.reload();
        await expect(guestBooking.calendarDay).toHaveCount(0);
        await expect(guestBooking.calendarTime).toHaveCount(0);
      }).toPass({ timeout: 15_000 });
    });
  });
});
