import { test, expect } from '@playwright/test';
import {
  makeUser,
  makeUnique,
  registerViaApi,
  deleteAccountViaApi,
  type TestUser,
} from '../helpers/user';
import { ProfilePage } from '../pages/profile';

const RF_TIMEZONES = [
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
] as const;

test.describe('Заполнение профиля после регистрации', () => {
  let user: TestUser;
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    user = makeUser('student-hw8');
    await registerViaApi(page.context(), user);
    profilePage = new ProfilePage(page);
    await profilePage.open();
    await expect(profilePage.inputName).toHaveValue(user.name);
  });

  test.afterEach(async ({ page }) => {
    await deleteAccountViaApi(page.context()).catch(() => undefined);
  });

  test('Смена имени в профиле', async ({ page }) => {
    const newName = makeUnique('Hw10');

    await test.step('Заполняем новое имя и сохраняем', async () => {
      await profilePage.inputName.clear();
      await profilePage.inputName.fill(newName);
      await profilePage.save();
    });

    await test.step('После перезагрузки имя пришло с сервера', async () => {
      await page.reload();
      await expect(profilePage.inputName).toHaveValue(newName);
    });
  });

  test('Список часовых поясов соответствует спецификации', async () => {
    await test.step('По умолчанию выбран Europe/Moscow', async () => {
      await expect(profilePage.timezoneSelect).toHaveValue('Europe/Moscow');
    });

    await test.step('Полный список совпадает с требованиями', async () => {
      const options = await profilePage.getTimezoneOptions();
      expect(options).toEqual([...RF_TIMEZONES]);
    });
  });

  test('Все часовые пояса сохраняются и возвращаются с сервера', async ({ page }) => {
    const zones = await profilePage.getTimezoneOptions();

    for (const tz of zones) {
      await test.step(`Пояс ${tz}: сохраняем и проверяем после перезагрузки`, async () => {
        await profilePage.timezoneSelect.selectOption(tz);
        await profilePage.save();
        await page.reload();
        await expect.soft(profilePage.timezoneSelect).toHaveValue(tz);
      });
    }
  });

  test('Заполнение поля Telegram', async ({ page }) => {
    const telegram = `@qaDarya${Date.now()}`;

    await test.step('Заполняем и сохраняем', async () => {
      await expect(profilePage.inputTelegram).toHaveValue('');
      await profilePage.inputTelegram.fill(telegram);
      await profilePage.save();
    });

    await test.step('После обновления страницы Telegram пришёл с сервера', async () => {
      await page.reload();
      await expect(profilePage.inputTelegram).toHaveValue(telegram);
    });
  });

  test('Заполняем поле "О себе"', async ({ page }) => {
    const infoAboutMyself = `QA-student ${Date.now()}`;

    await test.step('Заполняем и сохраняем', async () => {
      await profilePage.inputAboutMe.fill(infoAboutMyself);
      await profilePage.save();
    });

    await test.step('После обновления текст пришёл с сервера', async () => {
      await page.reload();
      await expect(profilePage.inputAboutMe).toHaveValue(infoAboutMyself);
    });
  });

  test('Навык: заполняем, выбираем, добавляем', async () => {
    const skillTag = `Playwright-demo-${Date.now()}`;

    await test.step('Добавляем навык «могу помочь»', async () => {
      await profilePage.addSkill(skillTag);
    });

    await test.step('Навык появился в блоке «Могу помочь»', async () => {
      await expect(profilePage.canHelpSkills).toContainText(skillTag);
    });
  });

  test('Навык «хочу разобрать»: выбираем второй тип и добавляем', async () => {
    const skillTag = makeUnique('WantToLearn');

    await test.step('Добавляем навык с типом «хочу разобрать»', async () => {
      await profilePage.addSkill(skillTag, 'want_to_learn');
    });

    await test.step('Навык появился в блоке «Хочу разобрать»', async () => {
      await expect(profilePage.wantToLearnSkills).toContainText(skillTag);
    });
  });
});
