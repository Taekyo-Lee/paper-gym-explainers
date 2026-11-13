import { describe, expect, it } from 'vitest'
import { hash32, rng } from './prng'
import {
  biSoftmax,
  concatRows,
  fromRows,
  layerNorm,
  matmul,
  matmulAT,
  matmulBT,
  maxAbsDiff,
  rowSums,
  sliceRows,
  softmaxRows,
  tensor,
  transpose,
} from './tensor'

function naiveMatmul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)))
}

describe('tensor', () => {
  const a = fromRows([
    [1, 2, 0],
    [-1, 0.5, 3],
  ])
  const b = fromRows([
    [2, 1],
    [0, -1],
    [4, 0.5],
  ])

  it('matmul, matmulBT, matmulAT가 손 계산과 같다', () => {
    const expected = fromRows(naiveMatmul([[1, 2, 0], [-1, 0.5, 3]], [[2, 1], [0, -1], [4, 0.5]]))
    expect(maxAbsDiff(matmul(a, b), expected)).toBe(0)
    expect(maxAbsDiff(matmulBT(a, transpose(b)), expected)).toBe(0)
    expect(maxAbsDiff(matmulAT(transpose(a), b), expected)).toBe(0)
  })

  it('softmaxRows: 행 합 1, 가린 칸은 정확히 0, 온도는 logits를 나눈다', () => {
    const logits = fromRows([
      [1, 2, 3],
      [0, 0, 0],
    ])
    const s = softmaxRows(logits)
    for (const sum of rowSums(s)) expect(sum).toBeCloseTo(1, 6)
    const masked = softmaxRows(logits, '', { keyMask: Uint8Array.from([0, 1, 0]) })
    expect(masked.data[1]).toBe(0)
    expect(masked.data[0] + masked.data[2]).toBeCloseTo(1, 6)
    const hot = softmaxRows(logits, '', { temperature: 2 })
    const scaled = softmaxRows(fromRows([[0.5, 1, 1.5], [0, 0, 0]]))
    expect(maxAbsDiff(hot, scaled)).toBeLessThan(1e-6)
  })

  it('softmaxRows의 allowed mask: 막힌 칸은 0, 모두 막힌 행은 전부 0', () => {
    const logits = fromRows([
      [1, 2, 3],
      [4, 5, 6],
    ])
    const allowed = Uint8Array.from([1, 0, 1, 0, 0, 0])
    const s = softmaxRows(logits, '', { allowed })
    expect(s.data[1]).toBe(0)
    expect(s.data[0] + s.data[2]).toBeCloseTo(1, 6)
    expect(Array.from(s.data.subarray(3))).toEqual([0, 0, 0])
  })

  it('biSoftmax = 두 방향 softmax를 따로 계산한 것 (빠른 경로와 fallback, 온도와 mask 포함)', () => {
    const pad = Uint8Array.from([0, 0, 1, 0, 0])
    const cases: [number, number, boolean][] = [
      [1, 0.5, false],
      [1, 1.3, false],
      [30, 1.3, true], // 범위가 넓어 fallback
    ]
    for (const [std, T, isFallback] of cases) {
      const S = tensor(6, 5, '', rng(9, `bs${std}`).normalArray(30, std))
      let max = -Infinity
      let min = Infinity
      for (const v of S.data) {
        max = Math.max(max, v)
        min = Math.min(min, v)
      }
      expect((max - min) / T > 80).toBe(isFallback)
      const { rowWise, colWise } = biSoftmax(S, T, pad)
      expect(maxAbsDiff(rowWise, softmaxRows(S, '', { temperature: T, keyMask: pad }))).toBeLessThan(1e-6)
      expect(maxAbsDiff(colWise, softmaxRows(transpose(S), '', { temperature: T }))).toBeLessThan(1e-6)
    }
  })

  it('layerNorm: 행마다 평균 0, 분산 1', () => {
    const x = tensor(4, 256, '', rng(3, 'ln').normalArray(1024, 5))
    const y = layerNorm(x)
    for (let r = 0; r < 4; r++) {
      const row = Array.from(y.data.subarray(r * 256, (r + 1) * 256))
      const mean = row.reduce((s, v) => s + v, 0) / 256
      const variance = row.reduce((s, v) => s + (v - mean) ** 2, 0) / 256
      expect(mean).toBeCloseTo(0, 4)
      expect(variance).toBeCloseTo(1, 3)
    }
  })

  it('concatRows와 sliceRows는 토큰 축(세로)으로 잇고 자른다', () => {
    const c = concatRows([a, a])
    expect([c.rows, c.cols]).toEqual([4, 3])
    expect(maxAbsDiff(sliceRows(c, 2, 4), a)).toBe(0)
  })
})

describe('prng', () => {
  it('같은 seed와 stream이면 같은 수열, 다르면 다른 수열', () => {
    const x = rng(7, 'a').normalArray(8)
    expect(Array.from(rng(7, 'a').normalArray(8))).toEqual(Array.from(x))
    expect(Array.from(rng(7, 'b').normalArray(8))).not.toEqual(Array.from(x))
    expect(Array.from(rng(8, 'a').normalArray(8))).not.toEqual(Array.from(x))
    expect(hash32('abc')).toBe(hash32('abc'))
  })

  it('noiseArray는 평균 0, 표준편차 std에 가깝다', () => {
    const v = rng(1, 'noise').noiseArray(20000, 2)
    const mean = v.reduce((s, x) => s + x, 0) / v.length
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length)
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(std).toBeCloseTo(2, 1)
  })
})
