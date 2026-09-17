# codex.md — правила и карта репозитория PomidorQA Tests

Эталонные автотесты учебного стенда PomidorQA (`https://aiqa.su/pomidorqa`) на **Playwright + TypeScript**.
Этот файл — главный источник правды для агентов и ИИ: структура, конвенции, команды. При написании и правке тестов следуй ему, а не общим представлениям о «хороших тестах».

## Карта репозитория

| Путь                    | Что там                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/pages/`          | Page Objects (`booking.ts`, `profile.ts`, `slots.ts`, `catalog.ts`) — все локаторы и действия над страницей живут только здесь                |
| `tests/helpers/user.ts` | Хелперы: `ROUTES`, `makeUser()`, `makeUnique()`, `registerViaApi()`, `registerUser()`, `loginUser()`, `deleteAccountViaApi()`, тип `TestUser` |
| `tests/e2e/`            | E2E-спеки: браузерные сценарии, `baseURL` = `https://aiqa.su`                                                                                 |
| `tests/api/`            | API-тесты: HTTP к локальному мок-серверу                                                                                                      |
| `tests/unit/`           | Юнит-тесты чистых функций                                                                                                                     |
| `src/pyramid/`          | Логика предметной области и мок-API (`slots.ts`, `mock-booking-api.ts`)                                                                       |
| `playwright.config.ts`  | Проекты `unit`, `api`, `e2e`; env `POMIDORQA_BASE_URL`; trace/screenshot/video пишутся только при падении                                     |
| `eslint.config.mjs`     | Flat config: typescript-eslint + eslint-plugin-playwright                                                                                     |

## Команды

```bash
npm test                                           # все проекты
npm run test:e2e                                   # только e2e
npx playwright test tests/e2e/login-error.spec.ts  # один файл
npx playwright test -g "вход"                      # по названию теста
npm run lint                                       # ESLint по tests/
npx eslint tests/pages/catalog.ts --fix            # линт конкретных файлов с автофиксом
npm run report                                     # HTML-отчёт последнего прогона
```

Артефакты падений (trace, скриншоты, видео) лежат в `test-results/` — читать их при разборе падения.

## Конвенции

### Спеки (`tests/e2e`)

- Названия тестов и `test.step` — **на русском**; шаги описывают действия пользователя, а не технические операции.
- Структура: `test.describe` → `beforeEach` с `registerViaApi()` → `afterEach` с `deleteAccountViaApi(...).catch(() => undefined)` → тесты.
- Тестовые данные только через `makeUser(role)` и `makeUnique()` — никаких хардкодов email/имён: стенд общий, аккаунты и слоты конкурируют между прогонами.
- Многосессионные сценарии (хост + гости): `browser.newContext()` на каждого участника, очистка аккаунтов в `finally`.
- Ожидания — только auto-waiting: `expect(locator).toBeVisible()`, `toHaveText()`, `expect(...).toPass()`, `expect.poll`. Фиксированных пауз нет (см. ESLint ниже).

### Page Objects (`tests/pages`)

- Класс на страницу (`CatalogPage`), поля `readonly page` и `readonly`-локаторы, локаторы собираются в конструкторе.
- Локаторы семантические: `getByRole('button', { name: 'Найти' })`, `getByLabel('Email')`, `getByText('...')`, `getByTestId('person-card')`. CSS/XPath (`page.locator('#id')`) — осознанное исключение, когда семантики нет.
- Методы-действия инкапсулируют сценарий (`searchBy()`, `addSlot()`), переходы — через `ROUTES` из хелпера (`goto()`).
- Карточки/строки из списка — метод-фильтр вида `getPersonCard(name)` через `.filter({ hasText: ... })`.
- Новый локатор из спеки добавляется **в page object**, а не в тест. Спека не правит page object без необходимости.

### Helpers (`tests/helpers/user.ts`)

- Регистрация и удаление аккаунтов — только через API-хелперы (`registerViaApi`, `deleteAccountViaApi`): быстрее и стабильнее, чем через UI.
- Повторяющиеся шаги (логин, подготовка данных, роуты) — в хелпер, а не копипастой по спекам.

## ESLint — что ломает CI

`eslint-plugin-playwright` (flat/recommended) + правила уровня **error**:
`no-wait-for-timeout`, `no-force-option`, `missing-playwright-await`, `no-commented-out-tests`, `no-page-pause`, `no-focused-test`, `expect-expect`.
Перед сдачей: `npx eslint <файлы> --fix`, остатки предупреждений чинить руками, не отключая правила.

## Сбор локаторов через Playwright MCP

Новые локаторы **не выдумывать по памяти** — снимать с живого стенда через MCP-инструменты браузера:

1. `browser_navigate` на нужную страницу (полный URL: `https://aiqa.su` + путь из `ROUTES`).
2. `browser_snapshot` — accessibility-дерево с refs элементов.
3. Выбрать семантический локатор: роль + имя → `getByRole`, подпись поля → `getByLabel`, видимый текст → `getByText`, `data-testid` → `getByTestId`.
4. Проверить локатор реальным действием через MCP (`browser_click`, `browser_type`) до того, как класть его в page object.

## Цикл «написал → зелёный»

1. Написал/поправил код → `npx eslint <файлы> --fix` → починить остатки вручную.
2. `npx playwright test <файл>` → упал: читать ошибку прогона и trace из `test-results/` → чинить → повторять (лимит ~5 итераций, дальше — отчёт с гипотезами).
3. Локально зелёный → прогнать смежные спеки или весь `npm run test:e2e` на регресс.
4. Отчёт: что написано, какая команда запускалась, результат прогона, статус линта.
