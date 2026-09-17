import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTES } from '../helpers/user';

export type FieldValidity = {
  valueMissing: boolean;
  typeMismatch: boolean;
  tooShort: boolean;
  valid: boolean;
};

export class RegisterPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly inputName: Locator;
  readonly inputEmail: Locator;
  readonly inputPassword: Locator;
  readonly btnSubmit: Locator;
  readonly emailTakenError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Регистрация в PomidorQA' });
    this.inputName = page.getByRole('textbox', { name: 'Имя' });
    this.inputEmail = page.getByRole('textbox', { name: 'Email' });
    this.inputPassword = page.getByLabel('Пароль');
    this.btnSubmit = page.getByRole('button', { name: 'Зарегистрироваться' });
    this.emailTakenError = page.getByText('Этот email уже зарегистрирован');
  }

  async open() {
    await this.page.goto(ROUTES.register);
  }

  async fillForm(name: string, email: string, password: string) {
    await this.inputName.fill(name);
    await this.inputEmail.fill(email);
    await this.inputPassword.fill(password);
  }

  async submit() {
    await this.btnSubmit.click();
  }

  async getValidity(input: Locator): Promise<FieldValidity> {
    return input.evaluate((el: HTMLInputElement) => ({
      valueMissing: el.validity.valueMissing,
      typeMismatch: el.validity.typeMismatch,
      tooShort: el.validity.tooShort,
      valid: el.validity.valid,
    }));
  }

  async expectOpened() {
    await expect(this.page).toHaveURL(ROUTES.register);
    await expect(this.heading).toBeVisible();
  }
}
