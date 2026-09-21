import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTES } from '../helpers/user';

export class SlotsPage {
  readonly page: Page;
  readonly slotDate: Locator;
  readonly slotTime: Locator;
  readonly btnAddSlot: Locator;
  readonly freeSlots: Locator;

  constructor(page: Page) {
    this.page = page;
    this.slotDate = page.locator('#pomidorqa-slots-date');
    this.slotTime = page.locator('#pomidorqa-slots-time');
    this.btnAddSlot = page.getByRole('button', { name: 'Добавить' });
    this.freeSlots = page.locator('div[data-slot-status="free"]');
  }

  async open() {
    await this.page.goto(ROUTES.slots);
  }

  async addSlot(date: string, time: string) {
    await this.slotDate.fill(date);
    await this.slotTime.fill(time);
    await this.btnAddSlot.click();
  }

  slotRow(status: 'free' | 'booked'): Locator {
    return this.page.locator(`[data-slot-status="${status}"]`);
  }

  async deleteFirstFreeSlot() {
    const btn = this.freeSlots.first().getByRole('button', { name: 'Удалить' });
    await expect(async () => {
      const removeResponse = this.page.waitForResponse(
        (resp) => resp.url().includes('/pomidorqa') && resp.request().method() !== 'GET',
        { timeout: 5_000 },
      );
      await btn.click();
      await removeResponse;
    }).toPass({ timeout: 15_000 });
  }
}
