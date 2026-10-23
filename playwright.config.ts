import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 35000, expect: { timeout: 7000 },
  fullyParallel: true, workers: 3, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && PORT=4174 RACE_DURATION_MS=3000 RACE_COUNTDOWN_MS=500 RACE_RECONNECT_GRACE_MS=2000 npm start', url: 'http://127.0.0.1:4174/health', reuseExistingServer: false, timeout: 60000 },
});
