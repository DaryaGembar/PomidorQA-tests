import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { ROUTES } from '../helpers/user';

export class SlotsPage {
  private readonly appAction = (resp: Response) =>
    resp.url().includes('/pomidorqa') && resp.request().method() !== 'GET';

  readonly page: Page;
  readonly slotDate: Locator;
  readonly slotTime: Locator;
  readonly btnAddSlot: Locator;
  readonly freeSlots: Locator;
  readonly blockedBooking: Locator;

  constructor(page: Page) {
    this.page = page;
    this.slotDate = page.locator('#pomidorqa-slots-date');
    this.slotTime = page.locator('#pomidorqa-slots-time');
    this.btnAddSlot = page.getByRole('button', { name: 'Добавить' });
    this.freeSlots = page.locator('div[data-slot-status="free"]');
    this.blockedBooking = page.getByRole('alert');
  }

  async open() {
    await this.page.goto(ROUTES.slots);
  }

  async addSlot(date: string, time: string) {
    await expect(async () => {
      const addResponse = this.page.waitForResponse(this.appAction, { timeout: 5_000 });
      await this.slotDate.fill(date);
      await this.slotTime.fill(time);
      await this.btnAddSlot.click();
      const response = await addResponse;
      if (response.status() >= 400) {
        throw new Error(`Слот не добавлен: сервер ответил HTTP ${response.status()}`);
      }
    }).toPass({ timeout: 20_000 });
  }

  slotRow(status: 'free' | 'booked'): Locator {
    return this.page.locator(`[data-slot-status="${status}"]`);
  }

  async deleteFirstFreeSlot() {
    const btn = this.freeSlots.first().getByRole('button', { name: 'Удалить' });
    await expect(async () => {
      const removeResponse = this.page.waitForResponse(this.appAction, { timeout: 5_000 });
      await btn.click();
      await removeResponse;
    }).toPass({ timeout: 15_000 });
  }
}
