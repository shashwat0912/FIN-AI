import { defineConfig } from '@playwright/test';

const deployed = process.env.SMOKE_BASE_URL;
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 90_000,
  use: { baseURL: deployed || 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'retain-on-failure' },
  reporter: 'list',
  webServer: deployed ? undefined : [
    { command: 'node scripts/smoke-server.mjs', url: 'http://127.0.0.1:3001/livez', reuseExistingServer: false },
    { command: 'npm run dev:frontend -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:3001/api/v1' } },
  ],
});
