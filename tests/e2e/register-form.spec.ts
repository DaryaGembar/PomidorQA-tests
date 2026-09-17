import { test, expect } from '@playwright/test';
import { makeUser, registerViaApi, deleteAccountViaApi, type TestUser } from '../helpers/user';
import { RegisterPage } from '../pages/auth';
import { SiteHeader } from '../pages/header';

test.describe('Форма регистрации', () => {
  let user: TestUser;
  let register: RegisterPage;
  let header: SiteHeader;

  test.beforeEach(async ({ page }) => {
    user = makeUser('register-form');
    register = new RegisterPage(page);
    header = new SiteHeader(page);
    await register.open();
  });

  test.afterEach(async ({ page }) => {
    await deleteAccountViaApi(page.context()).catch(() => undefined);
  });

  test('успешная регистрация нового пользователя через форму', async ({ page }) => {
    await test.step('Заполняем все поля формы валидными данными', async () => {
      await register.fillForm(user.name, user.email, user.password);
    });

    await test.step('Отправляем форму', async () => {
      await register.submit();
    });

    await test.step('Попадаем в каталог и видим авторизованную шапку', async () => {
      await expect(page).toHaveURL(/\/pomidorqa\/?$/, { timeout: 8_000 });
      await header.expectLoggedIn();
    });
  });

  test('пустая форма не отправляется — обязательные поля блокируют сабмит', async () => {
    await test.step('Нажимаем «Зарегистрироваться» на пустой форме', async () => {
      await register.submit();
    });

    await test.step('Остаёмся на странице регистрации', async () => {
      await register.expectOpened();
    });

    await test.step('Каждое поле помечено как незаполненное', async () => {
      for (const input of [register.inputName, register.inputEmail, register.inputPassword]) {
        expect(await register.getValidity(input)).toMatchObject({
          valueMissing: true,
          valid: false,
        });
      }
    });
  });

  test('пароль короче 8 символов не проходит валидацию', async ({ page }) => {
    const shortPassword = user.password.slice(0, 7);

    await test.step('Заполняем форму паролем из 7 символов', async () => {
      await register.fillForm(user.name, user.email, shortPassword);
    });

    await test.step('Отправляем форму', async () => {
      await register.submit();
    });

    await test.step('Остаёмся на странице регистрации — поле пароля помечено как слишком короткое', async () => {
      await register.expectOpened();
      expect(await register.getValidity(register.inputPassword)).toMatchObject({
        tooShort: true,
        valid: false,
      });
    });
  });

  test('email без «@» не проходит валидацию', async ({ page }) => {
    await test.step('Заполняем форму некорректным email', async () => {
      await register.fillForm(user.name, 'not-an-email', user.password);
    });

    await test.step('Отправляем форму', async () => {
      await register.submit();
    });

    await test.step('Остаёмся на странице регистрации — поле email помечено как некорректное', async () => {
      await register.expectOpened();
      expect(await register.getValidity(register.inputEmail)).toMatchObject({
        typeMismatch: true,
        valid: false,
      });
    });
  });

  test('уже зарегистрированный email — форма показывает ошибку сервера', async ({ page }) => {
    await test.step('Регистрируем аккаунт по API, чтобы занять email', async () => {
      await registerViaApi(page.context(), user);
    });

    await test.step('Заполняем форму тем же email и отправляем', async () => {
      await register.fillForm(user.name, user.email, user.password);
      await register.submit();
    });

    await test.step('Форма остаётся открытой и показывает ошибку о занятом email', async () => {
      await register.expectOpened();
      await expect(register.emailTakenError).toBeVisible();
    });
  });
});
