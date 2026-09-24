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
import { PublicProfilePage } from '../pages/public-profile';

test.describe('Публичный профиль участника', () => {
  let host: TestUser;
  let hostContext: BrowserContext;
  let hostPage: Page;
  let hostProfile: ProfilePage;
  let hostSlots: SlotsPage;
  let skillTag: string;
  let wantTag: string;
  let telegram: string;
  let about: string;

  test.beforeEach(async ({ browser }) => {
    hostContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    host = makeUser('host');
    skillTag = makeUnique('PublicCanHelp');
    wantTag = makeUnique('PublicWant');
    telegram = makeUnique('@public');
    about = makeUnique('PublicProfile: ручное и автоматизированное тестирование');

    await registerViaApi(hostContext, host);

    hostProfile = new ProfilePage(hostPage);
    hostSlots = new SlotsPage(hostPage);
    await hostProfile.open();

    await hostProfile.inputTelegram.fill(telegram);
    await hostProfile.inputAboutMe.fill(about);
    await hostProfile.addSkill(skillTag);
    await hostProfile.addSkill(wantTag, 'want_to_learn');
    await hostProfile.save();
    await hostSlots.open();
    await hostSlots.addSlot(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), '12:00');
    await expect(hostSlots.freeSlots).toBeVisible();
  });

  test.afterEach(async () => {
    await deleteAccountViaApi(hostContext).catch(() => undefined);
    await hostContext.close();
  });

  test('Гость видит на карточке участника полный профиль', async ({ page }) => {
    const catalog = new CatalogPage(page);
    const publicProfile = new PublicProfilePage(page);
    const guestBooking = new BookingPage(page);

    await test.step('Гость: находит хоста по навыку «могу помочь» и открывает карточку', async () => {
      await catalog.goto();

      await expect(async () => {
        await catalog.searchBy(skillTag);
        await expect(catalog.getPersonCard(host.name)).toBeVisible();
      }).toPass({ timeout: 20_000 });
      await catalog.getPersonCard(host.name).click();
    });

    await test.step('Проверка: имя, Telegram и «О себе» пришли с сервера', async () => {
      await expect(publicProfile.personName).toHaveText(host.name);
      await expect(publicProfile.telegram(telegram)).toBeVisible();
      await expect(publicProfile.about(about)).toBeVisible();
    });

    await test.step('Проверка: навыки обоих типов на карточке', async () => {
      await expect(publicProfile.skillBlock('Может помочь с')).toContainText(skillTag);
      await expect(publicProfile.skillBlock('Хочет разобрать')).toContainText(wantTag);
    });

    await test.step('Проверка: свободные слоты видны', async () => {
      await guestBooking.waitForFreeSlot();
    });
  });
});
