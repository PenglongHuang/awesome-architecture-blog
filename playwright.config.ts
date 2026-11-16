import { normalizeBase, DEFAULT_BASE } from './src/lib/site-urls.mjs'
import { defineConfig } from '@playwright/test'

const base = normalizeBase(process.env.BASE_PATH || DEFAULT_BASE)
const url = `http://localhost:4321${base}`

export default defineConfig({
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: url,
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? 'pnpm preview --port 4321 --ignore-lock' : 'pnpm build && pnpm preview --port 4321 --ignore-lock',
    url: url,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
