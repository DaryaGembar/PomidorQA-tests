import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { deleteAccountViaApi, makeUnique, makeUser, registerViaApi, type TestUser } from './user';
import { ProfilePage } from '../pages/profile';
import { SlotsPage } from '../pages/slots';

// Слоты считаем в Europe/Moscow — дефолтный часовой пояс профиля на стенде (R5.3).
const STAND_TZ = 'Europe/Moscow';

/** Дата на стенде в формате формы слотов: standDate(0) — сегодня, standDate(1) — завтра. */
export function standDate(daysAhead: number, from: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STAND_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(from.getTime() + daysAhead * 86_400_000));
}

/** Дата и время через N минут от текущего момента — для слотов у границы окна отмены. */
export function standDateTime(minutesAhead: number, from: Date = new Date()): {
  date: string;
  time: string;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: STAND_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(from.getTime() + minutesAhead * 60_000))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * Сцена пользователя: аккаунт (поля TestUser + id с сервера), контекст браузера
 * и залогиненная страница — регистрация через API ставит сессию в контекст.
 */
export type UserScene = TestUser & {
  id: string;
  context: BrowserContext;
  page: Page;
};

/** Сцена хоста: сцена пользователя плюс page objects профиля и слотов, тег навыка. */
export type HostScene = UserScene & {
  profile: ProfilePage;
  slots: SlotsPage;
  skillTag: string;
};

export async function createUserScene(browser: Browser, role: string): Promise<UserScene> {
  const context = await browser.newContext();
  try {
    const user = makeUser(role);
    const { id } = await registerViaApi(context, user);
    return { ...user, id, context, page: await context.newPage() };
  } catch (error) {
    await deleteAccountViaApi(context).catch(() => undefined);
    await context.close();
    throw error;
  }
}

export type HostOptions = {
  role?: string;
  skillTag?: string;
  skillType?: 'can_help' | 'want_to_learn';
  slotTime?: string;
  daysAhead?: number;
  minutesAhead?: number;
  withSlot?: boolean;
};

/**
 * Хост с навыком и свободным слотом — общий arrange сценариев бронирования.
 * По умолчанию: навык «могу помочь» и слот завтра на 12:00. minutesAhead задаёт слот
 * относительно текущего момента (граница окна отмены), withSlot: false — хост без слота.
 * Если arrange падает после регистрации, аккаунт удаляется перед пробросом ошибки.
 */
export async function createHostWithSlot(
  browser: Browser,
  options: HostOptions = {},
): Promise<HostScene> {
  const scene = await createUserScene(browser, options.role ?? 'host');
  const skillTag = options.skillTag ?? makeUnique(options.skillType === 'want_to_learn' ? 'WantToLearn' : 'CanHelp');
  const profile = new ProfilePage(scene.page);
  const slots = new SlotsPage(scene.page);

  try {
    await profile.open();
    await profile.addSkill(skillTag, options.skillType ?? 'can_help');
    const skillBlock =
      options.skillType === 'want_to_learn' ? profile.wantToLearnSkills : profile.canHelpSkills;
    await expect(skillBlock).toContainText(skillTag);

    if (options.withSlot !== false) {
      const slot =
        options.minutesAhead !== undefined
          ? standDateTime(options.minutesAhead)
          : { date: standDate(options.daysAhead ?? 1), time: options.slotTime ?? '12:00' };
      await slots.open();
      await slots.addSlot(slot.date, slot.time);
      await expect(slots.freeSlots).toBeVisible();
    }
  } catch (error) {
    await deleteScenes(scene);
    throw error;
  }

  return { ...scene, profile, slots, skillTag };
}

/**
 * Гарантированная уборка сцен: удаляет аккаунты каскадом (навыки → слоты → брони)
 * и закрывает контексты. undefined пропускается — сцена могла не успеть создаться.
 */
export async function deleteScenes(...scenes: Array<UserScene | undefined>): Promise<void> {
  for (const scene of scenes) {
    if (!scene) continue;
    await deleteAccountViaApi(scene.context).catch(() => undefined);
    await scene.context.close();
  }
}
