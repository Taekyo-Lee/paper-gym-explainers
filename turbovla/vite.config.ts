import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// GitHub Pages 하위 경로. 다른 경로에 올릴 때는 BASE_PATH 환경 변수로 바꾼다.
const DEFAULT_BASE = '/paper-gym-explainers/turbovla/'

// dev 서버는 '/'에서, build와 preview는 배포 경로에서 동작한다.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? DEFAULT_BASE) : '/',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}))
