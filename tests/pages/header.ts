import { expect, type Locator, type Page } from '@playwright/test';

// Шапка одна и та же на всех страницах PomidorQA — поэтому отдельный page object.
// Локаторы скоупятся на banner, чтобы не пересекаться с похожими ссылками в контенте страницы.
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
