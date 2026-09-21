import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { ROUTES } from '../helpers/user';

export class ProfilePage {
  private readonly appAction = (resp: Response) =>
    resp.url().includes('/pomidorqa') && resp.request().method() !== 'GET';

  readonly page: Page;
  readonly inputName: Locator;
  readonly inputTelegram: Locator;
  readonly inputAboutMe: Locator;
  readonly timezoneSelect: Locator;
  readonly inputSkill: Locator;
  readonly selectSkillType: Locator;
  readonly btnAddSkill: Locator;
  readonly canHelpSkills: Locator;
  readonly wantToLearnSkills: Locator;
  readonly btnSave: Locator;

  constructor(page: Page) {
    this.page = page;
    this.inputName = page.getByLabel('Имя');
    this.inputTelegram = page.locator('[placeholder="@username"]');
    this.inputAboutMe = page.getByLabel('О себе');
    this.timezoneSelect = page.getByLabel('Часовой пояс');
    this.inputSkill = page.locator('#pomidorqa-profile-skill-input');
    this.selectSkillType = page.locator('#pomidorqa-profile-skill-type');
    this.btnAddSkill = page.getByRole('button', { name: 'Добавить' });
    this.canHelpSkills = page.getByTestId('can-help-skills');
    this.wantToLearnSkills = page.locator('div:has(> p:text-is("Хочу разобрать"))');
    this.btnSave = page.getByRole('button', { name: 'Сохранить' });
  }

  async open() {
    await this.page.goto(ROUTES.profile);
  }

  async setName(name: string) {
    await this.inputName.clear();
    await this.inputName.fill(name);
  }

  async save() {
    await expect(async () => {
      const saveResponse = this.page.waitForResponse(this.appAction, { timeout: 5_000 });
      await this.btnSave.click();
      await saveResponse;
    }).toPass({ timeout: 15_000 });
  }

  async getTimezoneOptions(): Promise<string[]> {
    return this.timezoneSelect
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
  }

  async addSkill(tag: string, type: 'can_help' | 'want_to_learn' = 'can_help') {
    const addResponse = this.page.waitForResponse(this.appAction);
    await this.inputSkill.fill(tag);
    await this.selectSkillType.selectOption(type);
    await this.btnAddSkill.click();
    await addResponse;
  }

  async removeSkill(tag: string, type: 'can_help' | 'want_to_learn' = 'can_help') {
    const block = type === 'can_help' ? this.canHelpSkills : this.wantToLearnSkills;
    const btn = block.getByRole('button', { name: `Убрать ${tag}` });

    await expect(async () => {
      const removeResponse = this.page.waitForResponse(this.appAction, { timeout: 5_000 });
      await btn.click();
      await removeResponse;
    }).toPass({ timeout: 15_000 });
  }
}
