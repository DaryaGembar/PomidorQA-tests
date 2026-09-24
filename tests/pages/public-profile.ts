import { expect, type Locator, type Page } from '@playwright/test';

export class PublicProfilePage {
  readonly page: Page;
  readonly personName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.personName = page.getByRole('heading', { level: 1 });
  }

  skillBlock(heading: 'Может помочь с' | 'Хочет разобрать'): Locator {
    return this.page.locator(`div:has(> p:text-is("${heading}"))`);
  }

  telegram(username: string): Locator {
    return this.page.getByText(username);
  }

  about(text: string): Locator {
    return this.page.getByText(text);
  }
}
