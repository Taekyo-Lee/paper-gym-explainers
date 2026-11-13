// Playwright 스크린샷 smoke test. `npm run smoke`
// production build를 따로 만든 폴더(.smoke-dist)에서 띄운다: dist를 건드리지 않고, 배포 경로(base)도 그대로 확인한다.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const BASE = '/paper-gym-explainers/turbovla/'

export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  // 발표 화면 기준 1440 × 900
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}${BASE}`,
    viewport: { width: 1440, height: 900 },
    // 단계 이동을 부드러운 스크롤 없이 바로 끝내서, 스크린샷이 스크롤 도중에 찍히지 않게 한다
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `npx vite build --outDir .smoke-dist --emptyOutDir && npx vite preview --outDir .smoke-dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // 밖에서 BASE_PATH를 정해도 빌드와 테스트가 같은 경로를 쓰게 한다
    env: { BASE_PATH: BASE },
  },
})
