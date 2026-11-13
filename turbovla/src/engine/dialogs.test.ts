// 2017 비교 창에서 출력이 나타나는 순서와 loss 장난감 창의 수학.
import { describe, expect, it } from 'vitest'
import { canAttend, passesNeeded, passOfStep, revealedCount } from './decoding'
import { AMP_MAX, bestPrediction, column, demoChunks, l1, l2, mean, median, OUTLIER_DEMO, SPIKE_STEP, TOY_DEMOS, TOY_H } from './lossToy'

describe('autoregressive는 H개가 차례로, parallel은 한 번에', () => {
  for (const H of [1, 8, 12, 50]) {
    it(`H = ${H}`, () => {
      expect(passesNeeded('autoregressive', H)).toBe(H)
      expect(passesNeeded('parallel', H)).toBe(1)
      expect(revealedCount('autoregressive', 0, H)).toBe(0)
      expect(revealedCount('parallel', 0, H)).toBe(0)
      for (let p = 1; p <= H; p++) {
        // 한 번 돌릴 때마다 정확히 하나씩 늘어난다
        expect(revealedCount('autoregressive', p, H) - revealedCount('autoregressive', p - 1, H)).toBe(1)
        // parallel은 첫 실행에 모두 나온다
        expect(revealedCount('parallel', p, H)).toBe(H)
      }
      expect(revealedCount('autoregressive', H + 5, H)).toBe(H)
      for (let k = 0; k < H; k++) {
        expect(passOfStep('autoregressive', k)).toBe(k + 1)
        expect(passOfStep('parallel', k)).toBe(1)
      }
    })
  }

  it('autoregressive self-attention은 자기 자리와 앞자리만, parallel은 모두 본다', () => {
    const H = 6
    for (let i = 0; i < H; i++) {
      for (let j = 0; j < H; j++) {
        expect(canAttend('autoregressive', i, j)).toBe(j <= i)
        expect(canAttend('parallel', i, j)).toBe(true)
      }
    }
  })
})

describe('L1은 중앙값, L2는 평균', () => {
  const grid = Array.from({ length: 4001 }, (_, i) => -2 + i / 1000)
  const argmin = (f: (p: number) => number) => grid.reduce((best, p) => (f(p) < f(best) ? p : best), grid[0])

  it('모양: 시연 5개 × 12 step, 값은 [−1, 1] 안', () => {
    for (const amp of [0, AMP_MAX]) {
      const chunks = demoChunks(amp)
      expect(chunks).toHaveLength(TOY_DEMOS)
      for (const chunk of chunks) {
        expect(chunk).toHaveLength(TOY_H)
        for (const v of chunk) expect(Math.abs(v)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('step마다 L1 합이 가장 작은 예측은 중앙값, L2 합이 가장 작은 예측은 평균', () => {
    for (const amp of [0, 0.4, AMP_MAX]) {
      const chunks = demoChunks(amp)
      for (let k = 0; k < TOY_H; k++) {
        const ys = column(chunks, k)
        expect(argmin((p) => l1(p, ys))).toBeCloseTo(median(ys), 2)
        expect(argmin((p) => l2(p, ys))).toBeCloseTo(mean(ys), 2)
      }
      expect(bestPrediction(chunks, 'l1')[SPIKE_STEP]).toBe(median(column(chunks, SPIKE_STEP)))
      expect(bestPrediction(chunks, 'l2')[SPIKE_STEP]).toBeCloseTo(mean(column(chunks, SPIKE_STEP)), 12)
    }
  })

  it('튀는 값을 키우면 평균(L2)은 따라가고 중앙값(L1)은 거의 그대로다', () => {
    const calm = demoChunks(0)
    const wild = demoChunks(AMP_MAX)
    const shift = (loss: 'l1' | 'l2') => bestPrediction(wild, loss)[SPIKE_STEP] - bestPrediction(calm, loss)[SPIKE_STEP]
    // 평균은 튀는 값의 1/5만큼 움직인다
    expect(shift('l2')).toBeCloseTo(AMP_MAX / TOY_DEMOS, 6)
    // 중앙값은 순서가 바뀌는 만큼만 (이웃 시연 값 차이 이하)
    expect(Math.abs(shift('l1'))).toBeLessThan(0.06)
    expect(shift('l2')).toBeGreaterThan(3 * Math.abs(shift('l1')))
    // 튀는 값은 OUTLIER_DEMO에만 있다
    for (let i = 0; i < TOY_DEMOS; i++) {
      const moved = wild[i][SPIKE_STEP] - calm[i][SPIKE_STEP]
      expect(moved).toBeCloseTo(i === OUTLIER_DEMO ? AMP_MAX : 0, 6)
    }
  })
})
