import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  deleteAccountViaApi,
  makeUnique,
  makeUser,
  registerViaApi,
  type TestUser,
} from '../helpers/user';
import { CatalogPage } from '../pages/catalog';
import { BookingPage } from '../pages/booking';
import { ProfilePage } from '../pages/profile';
import { SlotsPage } from '../pages/slots';

test.describe('Отмена: окно 2 часа до начала', () => {
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
    skillTag = makeUnique('CancelWindow');

    await registerViaApi(hostContext, host);
    await registerViaApi(guestContext, guest);

    const hostProfile = new ProfilePage(hostPage);
    const hostSlots = new SlotsPage(hostPage);
    await hostProfile.open();
    await hostProfile.addSkill(skillTag);
    await expect(hostProfile.canHelpSkills).toContainText(skillTag);
    await hostSlots.open();

    const slotDate = new Date(Date.now() + 90 * 60 * 1000);
    await hostSlots.addSlot(
      slotDate.toISOString().slice(0, 10),
      `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}`,
    );
    await expect(hostSlots.freeSlots).toBeVisible();

    guestCatalog = new CatalogPage(guestPage);
    guestBooking = new BookingPage(guestPage);
  });

  test.afterEach(async () => {
    await deleteAccountViaApi(hostContext).catch(() => undefined);
    await deleteAccountViaApi(guestContext).catch(() => undefined);
    await hostContext.close();
    await guestContext.close();
  });

  test('Отмена запрещена позже чем за 2 часа до начала', async () => {
    await test.step('Гость: находит хоста и бронирует слот на ~90 минут', async () => {
      await guestCatalog.goto();

      await expect(async () => {
        await guestCatalog.searchBy(skillTag);
        await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
      }).toPass({ timeout: 20_000 });
      await guestCatalog.getPersonCard(host.name).click();
      await guestBooking.waitForFreeSlot();
      await guestBooking.selectFirstSlot();
      await guestBooking.confirmBooking();
      await expect(guestBooking.modalSuccess).toBeVisible();
    });

    await test.step('Гость: открывает «Мои встречи» и жмёт «Отменить»', async () => {
      await guestBooking.openBookings();
      await guestBooking.cancelButtonFor(host.name).click();
    });

    await test.step('Проверка: отказ с причиной — встреча остаётся в «Ближайших»', async () => {
      await expect(guestPage).toHaveURL(/cancelError=window/);
      await expect(guestBooking.cancelRefusalAlert).toBeVisible();
      await expect(guestBooking.upcomingBookings).toHaveCount(1);
    });

    await test.step('Проверка: в «Прошедших и отменённых» пусто', async () => {
      await expect(guestBooking.pastBookings).toHaveCount(0);
    });
  });
});
