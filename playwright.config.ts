import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:4321/awesome-architecture-blog/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4321',
    url: 'http://localhost:4321/awesome-architecture-blog/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
