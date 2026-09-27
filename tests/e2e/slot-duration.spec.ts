import { test, expect } from '@playwright/test';
import { makeUnique, ROUTES } from '../helpers/user';
import {
  createUserScene,
  deleteScenes,
  standDate,
  type UserScene,
} from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';
import { ProfilePage } from '../pages/profile';
import { SlotsPage } from '../pages/slots';
import { BookingPage } from '../pages/booking';

test.describe('Длительность слота — 25 минут (R7.1): границы наблюдаемости', () => {
  let host: UserScene;
  let slots: SlotsPage;
  let booking: BookingPage;
  let personUrl: string;

  test.beforeEach(async ({ browser }) => {
    host = await createUserScene(browser, 'host');
    slots = new SlotsPage(host.page);
    booking = new BookingPage(host.page);
    personUrl = `${ROUTES.catalog}/people/${host.id}`;
  });

  test.afterEach(async () => {
    await deleteScenes(host);
  });

  // Подпись «25 минут» в диалоге — строковый литерал в клиентском бандле стенда
  // (рядом с вычисляемым из start_time началом), а не вычисленная длительность.
  // Этот тест документирует интерфейс макета и не доказывает само правило R7.1.
  test('Поверхности брони показывают только начало слота, «25 минут» в диалоге — статичный текст', async () => {
    await test.step('Хост добавляет свободный слот на завтра 12:00', async () => {
      await slots.open();
      await slots.addSlot(standDate(1), '12:00');
      await expect(slots.freeSlots).toBeVisible();
    });

    await test.step('В строке слота — только начало 12:00, времени конца нет', async () => {
      await expect(slots.slotRow('free')).toHaveCount(1);
      await expect(slots.slotRow('free')).toContainText('12:00');
      await expect(slots.slotRow('free')).not.toContainText('12:25');
    });

    await test.step('Открываем свою карточку участника', async () => {
      await host.page.goto(personUrl);
      await booking.waitForFreeSlot();
    });

    await test.step('Чип времени в календаре показывает только начало', async () => {
      await expect(booking.calendarTime).toHaveText(['12:00']);
    });

    await test.step('Диалог подтверждения показывает «12:00 · 25 минут»', async () => {
      await booking.openConfirmDialogForFirstSlot();
      await expect(booking.confirmModalDialog).toContainText('12:00 · 25 минут');
    });

    await test.step('Закрываем диалог кнопкой «Отмена»', async () => {
      await booking.cancelConfirmDialog();
    });
  });

  test('Слоты на 25-минутной сетке можно ставить впритык: 12:00 и 12:25', async () => {
    await test.step('Хост добавляет свободный слот на завтра 12:00', async () => {
      await slots.open();
      await slots.addSlot(standDate(1), '12:00');
      await expect(slots.freeSlots).toBeVisible();
    });

    await test.step('Хост добавляет слот 12:25 впритык — стенд принимает', async () => {
      await slots.addSlot(standDate(1), '12:25');
      await expect(slots.freeSlots).toHaveCount(2);
    });

    await test.step('У каждого слота в списке только начало, без времени конца', async () => {
      const lateRow = slots.slotRow('free').filter({ hasText: '12:25' });
      await expect(lateRow).toHaveCount(1);
      await expect(lateRow).toContainText('свободен');
      await expect(lateRow).not.toContainText('12:50');
    });
  });

  test('После брони «Мои встречи» у гостя и хоста показывают только начало встречи', async ({
    browser,
  }) => {
    const skillTag = makeUnique('Duration');
    const guest = await createUserScene(browser, 'guest');
    const guestCatalog = new CatalogPage(guest.page);
    const guestBooking = new BookingPage(guest.page);
    const hostProfile = new ProfilePage(host.page);

    try {
      await test.step('Хост добавляет навык «Могу помочь» и свободный слот на завтра 12:00', async () => {
        await hostProfile.open();
        await hostProfile.addSkill(skillTag);
        await expect(hostProfile.canHelpSkills).toContainText(skillTag);

        await slots.open();
        await slots.addSlot(standDate(1), '12:00');
        await expect(slots.freeSlots).toBeVisible();
      });

      await test.step('Гость ищет хоста в каталоге по навыку и открывает карточку', async () => {
        await guestCatalog.goto();
        await expect(async () => {
          await guestCatalog.searchBy(skillTag);
          await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
        }).toPass({ timeout: 20_000 });
        await guestCatalog.getPersonCard(host.name).click();
        await expect(guestCatalog.personName).toHaveText(host.name);
      });

      await test.step('Гость бронирует слот 12:00', async () => {
        await guestBooking.waitForFreeSlot();
        await guestBooking.selectFirstSlot();
        const result = await guestBooking.confirmBooking();
        expect(result).toBe('success');
      });

      await test.step('У гостя в «Мои встречи» карточка с началом 12:00 — без времени конца', async () => {
        await expect(async () => {
          await guestBooking.openBookings();
          await expect(guestBooking.upcomingBookingWith(host.name)).toContainText('12:00');
        }).toPass({ timeout: 20_000 });
        await expect(guestBooking.upcomingBookingWith(host.name)).toHaveCount(1);
        await expect(guestBooking.upcomingBookingWith(host.name)).not.toContainText('12:25');
        await expect(guestBooking.upcomingBookingWith(host.name)).not.toContainText('25 минут');
      });

      await test.step('У хоста в «Мои встречи» та же встреча — тоже только начало', async () => {
        await expect(async () => {
          await booking.openBookings();
          await expect(booking.upcomingBookingWith(guest.name)).toContainText('12:00');
        }).toPass({ timeout: 20_000 });
        await expect(booking.upcomingBookingWith(guest.name)).toHaveCount(1);
        await expect(booking.upcomingBookingWith(guest.name)).not.toContainText('12:25');
      });
    } finally {
      await deleteScenes(guest);
    }
  });
});
