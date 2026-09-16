# Шпаргалка: снапшот MCP → локатор Playwright

Принцип: локатор = то, как элемент видит пользователь (роль, имя, текст, подпись), а не то, как он свёрстан.

## Маппинг элементов снапшота

| Что видно в `browser_snapshot` | Локатор |
|---|---|
| `button "Найти"` | `page.getByRole('button', { name: 'Найти' })` |
| `textbox "Email"` (у поля есть подпись) | `page.getByLabel('Email')` |
| `checkbox "Согласен"` | `page.getByRole('checkbox', { name: 'Согласен' })` |
| `link "Мои встречи"` | `page.getByRole('link', { name: 'Мои встречи' })` |
| `heading "Каталог"` | `page.getByRole('heading', { name: 'Каталог' })` |
| Текст ошибки «Неверный email или пароль» | `page.getByText('Неверный email или пароль')` |
| `data-testid="person-card"` | `page.getByTestId('person-card')` |
| Элемент списка среди похожих | `page.getByTestId('person-card').filter({ hasText: name })` |
| Ничего семантического нет | кандидат на новый `data-testid` — сообщи в отчёте |

Уточнение контекста: `page.getByRole('dialog').getByRole('button', { name: 'Сохранить' })`, `locator.first()` — как крайнее средство.

## Приоритет локаторов
1. `getByRole` (роль + доступимое имя)
2. `getByLabel` (поля формы)
3. `getByTestId` (явные testid)
4. `getByText` (только для проверки сообщений, не для кликов по «просто тексту»)
5. `page.locator(CSS/XPath)` — осознанное исключение, документируй в отчёте

## Проверка локатора через MCP до переноса в код
1. `browser_snapshot` — нашёл элемент и его ref.
2. `browser_click` / `browser_type` по ref — поведение совпало с ожиданием.
3. Только теперь локатор в page object.

## Антипаттерны (часть из них ловит ESLint как error)
- `page.waitForTimeout(2000)` → `expect(locator).toBeVisible()` / `toPass()`
- `.click({ force: true })` → чинить локатор/состояние, а не давить проверку
- Забытый `await` перед экшеном/`expect` — гонки
- `test.only`, `page.pause()`, закомментированные тесты
- Тест без `expect` — действия без проверки не тест
- Хардкод email/имён — стенд общий, только `makeUser()`/`makeUnique()`
- Локатор «по памяти» без снапшота — главный источник падений
