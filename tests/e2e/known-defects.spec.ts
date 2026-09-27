import { test, expect } from '@playwright/test';
import { makeUnique } from '../helpers/user';
import { createHostWithSlot, deleteScenes, type HostScene } from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';

test.describe('Известные дефекты продукта', () => {
  let host: HostScene;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, {
      skillTag: makeUnique('KnownDefect'),
      skillType: 'want_to_learn',
    });
  });

  test.afterEach(async () => {
    await deleteScenes(host);
  });

  test.fail();
  test('Поиск не находит хоста по навыку из раздела «хочу разобрать» (KD-1)', async ({ page }) => {
    const catalog = new CatalogPage(page);

    await test.step('Гость: ищет по тегу навыка «хочу разобрать»', async () => {
      await catalog.goto();
      await expect(async () => {
        await catalog.searchBy(host.skillTag);
        await expect(catalog.emptyResult.or(catalog.getPersonCard(host.name))).toBeVisible();
      }).toPass({ timeout: 20_000 });
    });

    await test.step('Проверка по требованию: хоста в выдаче нет', async () => {
      await expect(catalog.getPersonCard(host.name)).toHaveCount(0);
    });
  });
});
