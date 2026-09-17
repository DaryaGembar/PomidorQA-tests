import { expect, type Locator, type Page } from '@playwright/test';

export class SiteHeader {
  readonly page: Page;
  readonly linkProfile: Locator;
  readonly btnLogout: Locator;

  constructor(page: Page) {
    this.page = page;
    const banner = page.getByRole('banner');
    this.linkProfile = banner.getByRole('link', { name: 'Профиль' });
    this.btnLogout = banner.getByRole('button', { name: 'Выйти' });
  }

  async expectLoggedIn() {
    await expect(this.linkProfile).toBeVisible();
    await expect(this.btnLogout).toBeVisible();
  }
}
