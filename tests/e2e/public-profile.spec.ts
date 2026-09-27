import { test, expect } from '@playwright/test';
import { makeUnique } from '../helpers/user';
import { createHostWithSlot, deleteScenes, type HostScene } from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';
import { BookingPage } from '../pages/booking';
import { PublicProfilePage } from '../pages/public-profile';

test.describe('Публичный профиль участника', () => {
  let host: HostScene;
  let wantTag: string;
  let telegram: string;
  let about: string;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, { skillTag: makeUnique('PublicCanHelp') });

    wantTag = makeUnique('PublicWant');
    telegram = makeUnique('@public');
    about = makeUnique('PublicProfile: ручное и автоматизированное тестирование');

    // Слоты и навык «могу помочь» уже сохранены хелпером — дополняем профиль и сохраняем.
    await host.profile.open();
    await host.profile.inputTelegram.fill(telegram);
    await host.profile.inputAboutMe.fill(about);
    await host.profile.addSkill(wantTag, 'want_to_learn');
    await host.profile.save();
  });

  test.afterEach(async () => {
    await deleteScenes(host);
  });

  test('Гость видит на карточке участника полный профиль', async ({ page }) => {
    const catalog = new CatalogPage(page);
    const publicProfile = new PublicProfilePage(page);
    const guestBooking = new BookingPage(page);

    await test.step('Гость: находит хоста по навыку «могу помочь» и открывает карточку', async () => {
      await catalog.goto();

      await expect(async () => {
        await catalog.searchBy(host.skillTag);
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
      await expect(publicProfile.skillBlock('Может помочь с')).toContainText(host.skillTag);
      await expect(publicProfile.skillBlock('Хочет разобрать')).toContainText(wantTag);
    });

    await test.step('Проверка: свободные слоты видны', async () => {
      await guestBooking.waitForFreeSlot();
    });
  });
});
