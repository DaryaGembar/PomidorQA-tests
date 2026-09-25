import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 30_000,
  fullyParallel: false,
  // В CI повторяем падение один раз, чтобы заметить флак; локально ошибка видна сразу.
  retries: process.env.CI ? 1 : 0,
  // Два CI-worker ускоряют пайплайн: тесты изолированы уникальными аккаунтами
  // и не конкурируют за данные. Больше двух — лишняя нагрузка на общий стенд.
  workers: process.env.CI ? 2 : undefined,
  // В CI пишем лог и HTML-artifact, но не пытаемся открыть браузерное окно на headless-runner.
  // `junit` нужен dorny/test-reporter для таблицы в PR-комментарии и GitHub Actions Summary.
  // `allure-playwright` собирает историю, severity и attachments — Allure-отчёт можно открывать локально и в CI.
  reporter: [
    ["list"],
    ["html", { open: process.env.CI ? "never" : "on-failure" }],
    ["junit", { outputFile: "results.xml" }],
    ["allure-playwright", { outputFolder: "allure-results" }],
  ],
  projects: [
    {
      name: "unit",
      testDir: "./tests/unit",
      // без browser-контекста — тест общается только с чистой функцией
    },
    {
      name: "api",
      testDir: "./tests/api",
      // без browser-контекста — тест общается только по HTTP с локальным мок-сервером
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.POMIDORQA_BASE_URL ?? "https://aiqa.su",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
  ],
});
