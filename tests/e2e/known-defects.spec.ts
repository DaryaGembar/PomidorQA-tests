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

test.describe('Известные дефекты продукта', () => {
  let host: TestUser;
  let skillTag: string;
  let hostContext: BrowserContext;
  let hostPage: Page;
  let hostProfile: ProfilePage;
  let hostSlots: SlotsPage;

  test.beforeEach(async ({ browser }) => {
    hostContext = await browser.newContext();
    hostPage = await hostContext.newPage();
    host = makeUser('host');
    skillTag = makeUnique('KnownDefect');
    await registerViaApi(hostContext, host);

    hostProfile = new ProfilePage(hostPage);
    hostSlots = new SlotsPage(hostPage);
    await hostProfile.open();
    await hostProfile.addSkill(skillTag, 'want_to_learn');
    await expect(hostProfile.wantToLearnSkills).toContainText(skillTag);
    await hostSlots.open();
    await hostSlots.addSlot(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), '12:00');
    await expect(hostSlots.freeSlots).toBeVisible();
  });

  test.afterEach(async () => {
    await deleteAccountViaApi(hostContext).catch(() => undefined);
    await hostContext.close();
  });

  test.fail();
  test('Поиск не находит хоста по навыку из раздела «хочу разобрать» (KD-1)', async ({ page }) => {
    const catalog = new CatalogPage(page);

    await test.step('Гость: ищет по тегу навыка «хочу разобрать»', async () => {
      await catalog.goto();
      await expect(async () => {
        await catalog.searchBy(skillTag);
        await expect(catalog.emptyResult.or(catalog.getPersonCard(host.name))).toBeVisible();
      }).toPass({ timeout: 20_000 });
    });

    await test.step('Проверка по требованию: хоста в выдаче нет', async () => {
      await expect(catalog.getPersonCard(host.name)).toHaveCount(0);
    });
  });
});
