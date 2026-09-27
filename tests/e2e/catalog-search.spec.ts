import { test, expect } from '@playwright/test';
import { makeUnique } from '../helpers/user';
import {
  createHostWithSlot,
  createUserScene,
  deleteScenes,
  standDate,
  type HostScene,
  type UserScene,
} from '../helpers/stand';
import { CatalogPage } from '../pages/catalog';

test.describe('Каталог: поиск', () => {
  let host: HostScene;
  let guest: UserScene;
  let hostCatalog: CatalogPage;
  let guestCatalog: CatalogPage;

  test.beforeEach(async ({ browser }) => {
    host = await createHostWithSlot(browser, { skillTag: makeUnique('Search') });
    guest = await createUserScene(browser, 'guest');

    hostCatalog = new CatalogPage(host.page);
    guestCatalog = new CatalogPage(guest.page);

    await guestCatalog.goto();
  });

  test.afterEach(async () => {
    await deleteScenes(guest, host);
  });

  test('поиск по навыку находит карточку хоста со слотом', async () => {
    await test.step('Гость: ищет хоста по навыку', async () => {
      await guestCatalog.searchBy(host.skillTag);
    });

    await test.step('В выдаче карточка хоста — ровно одна', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
      await expect(guestCatalog.personCard).toHaveCount(1);
    });

    await test.step('Гость: открывает карточку хоста', async () => {
      await guestCatalog.getPersonCard(host.name).click();
    });

    await test.step('Открыт профиль найденного хоста', async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
    });
  });

  test('пустая выдача и сброс результатов при смене запроса', async () => {
    await test.step('Гость: ищет несуществующий навык', async () => {
      await guestCatalog.searchBy(makeUnique('Nobody-has'));
    });

    await test.step('Выдача пуста — карточек нет', async () => {
      await expect(guestCatalog.emptyResult).toBeVisible();
      await expect(guestCatalog.personCard).toHaveCount(0);
    });

    await test.step('Гость: ищет существующий навык', async () => {
      await guestCatalog.searchBy(host.skillTag);
    });

    await test.step('Карточка хоста снова одна', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
      await expect(guestCatalog.personCard).toHaveCount(1);
    });

    await test.step('Гость: снова ищет несуществующий навык', async () => {
      await guestCatalog.searchBy(makeUnique('Nobody-has'));
    });

    await test.step('Выдача снова пуста — результаты не накопились', async () => {
      await expect(guestCatalog.emptyResult).toBeVisible();
      await expect(guestCatalog.personCard).toHaveCount(0);
    });
  });

  test('хост без слота не попадает в каталог, а появившись — не видит сам себя', async () => {
    await test.step('Гость: ищет по навыку хоста', async () => {
      await guestCatalog.searchBy(host.skillTag);
    });

    await test.step('Контроль: гость видит карточку хоста', async () => {
      await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
    });

    await test.step('Хост: открывает каталог и ищет свой навык', async () => {
      await hostCatalog.goto();
      await hostCatalog.searchBy(host.skillTag);
    });

    await test.step('Своей карточки в выдаче нет', async () => {
      await expect(hostCatalog.getPersonCard(host.name)).toHaveCount(0);
      await expect(hostCatalog.emptyResult).toBeVisible();
    });
  });
});

test.describe('Каталог: попадание в выдачу зависит от слота', () => {
  let host: HostScene;
  let guest: UserScene;
  let guestCatalog: CatalogPage;

  test.beforeEach(async ({ browser }) => {
    // Слот не создаём — его появление и эффект на выдачу проверяет сам тест.
    host = await createHostWithSlot(browser, { skillTag: makeUnique('Search'), withSlot: false });
    guest = await createUserScene(browser, 'guest');

    guestCatalog = new CatalogPage(guest.page);
  });

  test.afterEach(async () => {
    await deleteScenes(guest, host);
  });

  test('хост с навыком, но без слота, не виден; после добавления слота появляется', async () => {
    await test.step('Гость: открывает каталог и ищет по навыку — хоста нет', async () => {
      await guestCatalog.goto();
      await guestCatalog.searchBy(host.skillTag);
      await expect(guestCatalog.emptyResult).toBeVisible();
      await expect(guestCatalog.personCard).toHaveCount(0);
    });

    await test.step('Хост: добавляет свободный слот на завтра', async () => {
      await host.slots.open();
      await host.slots.addSlot(standDate(1), '12:00');
    });

    await test.step('Гость: ищет снова — карточка появляется (индекс может запаздывать)', async () => {
      await expect(async () => {
        await guestCatalog.searchBy(host.skillTag);
        await expect(guestCatalog.getPersonCard(host.name)).toBeVisible();
      }).toPass({ timeout: 15_000 });
    });
  });
});
